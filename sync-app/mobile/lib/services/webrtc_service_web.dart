import 'dart:async';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/peer_connection.dart';

class WebRTCService {
  final String signalingUrl;
  final String sessionCode;
  final PeerRole role;
  final PeerConnectionConfig config;

  IO.Socket? _socket;
  RTCPeerConnection? _pc;
  final Map<String, RTCPeerConnection> _hostPcs = {};
  MediaStream? _localStream;
  MediaStream? _remoteStream;

  final _connectionStateCtrl = StreamController<RTCPeerConnectionState>.broadcast();
  final _iceConnectionStateCtrl = StreamController<RTCIceConnectionState>.broadcast();
  final _remoteStreamCtrl = StreamController<MediaStream>.broadcast();
  final _roomSizeCtrl = StreamController<int>.broadcast();
  final _latencyMsCtrl = StreamController<int>.broadcast();
  final _sourceCtrl = StreamController<String>.broadcast();
  final _switchSuggestCtrl = StreamController<String>.broadcast();
  Timer? _pingTimer;
  String? _currentSource;
  Timer? _sourcePollTimer;
  Timer? _activePageTimer;
  DateTime? _lastSwitchSuggestAt;

  HostInputType? _currentInput;

  Stream<RTCPeerConnectionState> get connectionStateStream => _connectionStateCtrl.stream;
  Stream<RTCIceConnectionState> get iceConnectionStateStream => _iceConnectionStateCtrl.stream;
  Stream<MediaStream> get remoteStreamStream => _remoteStreamCtrl.stream;
  Stream<int> get roomSizeStream => _roomSizeCtrl.stream;
  Stream<int> get latencyMsStream => _latencyMsCtrl.stream;
  Stream<String> get sourceStream => _sourceCtrl.stream;
  Stream<String> get switchSuggestionStream => _switchSuggestCtrl.stream;

  WebRTCService({
    required this.signalingUrl,
    required this.sessionCode,
    required this.role,
    this.config = const PeerConnectionConfig(),
  });

  Future<void> init() async {
    _socket = IO.io(signalingUrl, IO.OptionBuilder().setTransports(['websocket']).build());
    _socket!.onConnect((_) {
      _socket!.emit('join', { 'code': sessionCode });
    });

    _socket!.on('room-size', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      final size = (map['size'] ?? 0) as int;
      _roomSizeCtrl.add(size);
    });
    _socket!.on('participant-joined', (_) {
      _requestRoomSize();
      if (role == PeerRole.host && _currentSource != null) {
        _socket?.emit('source-update', { 'code': sessionCode, 'source': _currentSource });
      }
    });
    _socket!.on('participant-left', (_) => _requestRoomSize());

    _socket!.on('pong', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      final sent = (map['ts'] as num?)?.toInt();
      if (sent != null) {
        final now = DateTime.now().millisecondsSinceEpoch;
        final rtt = now - sent;
        _latencyMsCtrl.add(rtt);
      }
    });

    _socket!.on('source-update', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      final src = map['source'];
      if (src is String) {
        _sourceCtrl.add(src);
      }
    });

    _socket!.on('offer', (data) async {
      if (role == PeerRole.listener) {
        await _ensurePeerConnection();
        final sdpMap = Map<String, dynamic>.from(data as Map);
        final sdp = sdpMap['sdp'];
        await _pc!.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
        final answer = await _pc!.createAnswer();
        await _pc!.setLocalDescription(answer);
        final to = sdpMap['from'];
        _socket!.emit('answer', { 'code': sessionCode, 'sdp': answer.toMap(), 'to': to });
      }
    });

    _socket!.on('answer', (data) async {
      if (role == PeerRole.host) {
        final sdpMap = Map<String, dynamic>.from(data as Map);
        final sdp = sdpMap['sdp'];
        final from = sdpMap['from'] as String?;
        if (from != null && _hostPcs.containsKey(from)) {
          await _hostPcs[from]!.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
        }
      }
    });

    _socket!.on('ice-candidate', (data) async {
      final map = Map<String, dynamic>.from(data as Map);
      final c = map['candidate'];
      final cand = RTCIceCandidate(c['candidate'], c['sdpMid'], c['sdpMLineIndex']);
      if (role == PeerRole.host) {
        final from = map['from'] as String?;
        if (from != null && _hostPcs.containsKey(from)) {
          await _hostPcs[from]!.addCandidate(cand);
        }
      } else {
        await _pc?.addCandidate(cand);
      }
    });

    _socket!.on('request-offer', (data) async {
      if (role != PeerRole.host) return;
      final map = Map<String, dynamic>.from(data as Map);
      final to = map['to'];
      if (to == null) return;
      final pc = await _ensureHostPeerConnection(to);
      final offer = await pc.createOffer({
        'offerToReceiveAudio': 1,
        'offerToReceiveVideo': 0,
      });
      await pc.setLocalDescription(offer);
      _socket!.emit('offer', { 'code': sessionCode, 'sdp': offer.toMap(), 'to': to });
    });

    _startPing();
    if (kIsWeb) _startActivePagePolling();
  }

  void updateSource(String source) {
    _socket?.emit('source-update', { 'code': sessionCode, 'source': source });
    _sourceCtrl.add(source);
    _currentSource = source;
  }

  Future<void> attachLocalStream(MediaStream stream) async {
    _localStream = stream;
    if (role == PeerRole.listener) {
      await _ensurePeerConnection();
      for (var track in stream.getTracks()) {
        await _pc!.addTrack(track, stream);
      }
    }
    if (role == PeerRole.host) {
      _startSourcePolling();
    }
  }

  Future<MediaStream?> createAndAttachTabAudioStreamWeb() async {
    if (!kIsWeb) return null;
    final constraints = {
      'audio': true,
      'video': true,
    };
    final stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    final labels = <String>[];
    for (final t in stream.getAudioTracks()) {
      final lbl = t.label;
      if (lbl != null && lbl.isNotEmpty) labels.add(lbl);
    }
    if (stream.getAudioTracks().isEmpty) {
      for (final t in stream.getTracks()) {
        try { await t.stop(); } catch (_) {}
      }
      try { await stream.dispose(); } catch (_) {}
      return null;
    }
    for (final t in stream.getVideoTracks()) {
      final lbl = t.label;
      if (lbl != null && lbl.isNotEmpty) labels.add(lbl);
    }
    for (final t in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
      await t.stop();
      stream.removeTrack(t);
    }
    if (role == PeerRole.host) {
      await _setHostAudioStream(stream);
      final inferred = _inferSourceFromLabels(labels) ?? _extractDomainFromLabels(labels) ?? 'Shared Tab';
      updateSource(inferred);
      _currentInput = HostInputType.tab;
    } else {
      await attachLocalStream(stream);
    }
    return stream;
  }

  Future<bool> switchToTabAudioWeb() async {
    if (role != PeerRole.host) return false;
    final s = await createAndAttachTabAudioStreamWeb();
    return s != null;
  }

  Future<void> _ensurePeerConnection() async {
    if (_pc != null) return;
    final Map<String, dynamic> iceConfiguration = {
      'iceServers': config.iceServers,
      'sdpSemantics': 'unified-plan',
      'bundlePolicy': 'max-bundle',
    };
    _pc = await createPeerConnection(iceConfiguration);
    _remoteStream ??= await createLocalMediaStream('remote');
    if (role == PeerRole.listener) {
      await _pc!.addTransceiver(
        kind: RTCRtpMediaType.RTCRtpMediaTypeAudio,
        init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
      );
    }
    _pc!.onConnectionState = (state) {
      _connectionStateCtrl.add(state);
    };
    _pc!.onIceConnectionState = (state) {
      _iceConnectionStateCtrl.add(state);
    };
    _pc!.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        final payload = { 'code': sessionCode, 'candidate': candidate.toMap() };
        _socket?.emit('ice-candidate', payload);
      }
    };
    _pc!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        _remoteStream = event.streams[0];
      } else {
        _remoteStream?.addTrack(event.track);
      }
      if (_remoteStream != null) {
        _remoteStreamCtrl.add(_remoteStream!);
      }
    };
  }

  Future<RTCPeerConnection> _ensureHostPeerConnection(String toSocketId) async {
    if (_hostPcs.containsKey(toSocketId)) return _hostPcs[toSocketId]!;
    final Map<String, dynamic> iceConfiguration = {
      'iceServers': config.iceServers,
      'sdpSemantics': 'unified-plan',
      'bundlePolicy': 'max-bundle',
    };
    final pc = await createPeerConnection(iceConfiguration);
    if (_localStream != null) {
      for (var track in _localStream!.getTracks()) {
        await pc.addTrack(track, _localStream!);
      }
    }
    pc.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        final payload = { 'code': sessionCode, 'candidate': candidate.toMap(), 'to': toSocketId };
        _socket?.emit('ice-candidate', payload);
      }
    };
    pc.onConnectionState = (state) {
      _connectionStateCtrl.add(state);
    };
    _hostPcs[toSocketId] = pc;
    return pc;
  }

  Future<void> _setHostAudioStream(MediaStream newStream) async {
    final oldStream = _localStream;
    if (oldStream != null) {
      for (final t in oldStream.getAudioTracks()) {
        try { t.enabled = false; } catch (_) {}
      }
    }
    _localStream = newStream;
    final audioTracks = newStream.getAudioTracks();
    if (audioTracks.isEmpty) return;
    final newTrack = audioTracks.first;
    for (final pc in _hostPcs.values) {
      final senders = await pc.getSenders();
      RTCRtpSender? audioSender;
      for (final s in senders) {
        if (s.track != null && s.track!.kind == 'audio') {
          audioSender = s;
          break;
        }
      }
      audioSender ??= senders.isNotEmpty ? senders.first : null;
      if (audioSender != null && audioSender.track != null) {
        await audioSender.replaceTrack(newTrack);
      } else {
        await pc.addTrack(newTrack, newStream);
      }
    }
    if (oldStream != null && oldStream.id != newStream.id) {
      for (final t in oldStream.getTracks()) {
        try { await t.stop(); } catch (_) {}
      }
      try { await oldStream.dispose(); } catch (_) {}
    }
    if (role == PeerRole.host) {
      _startSourcePolling();
    }
  }

  void _startPing() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      final ts = DateTime.now().millisecondsSinceEpoch;
      _socket?.emit('ping', { 'ts': ts, 'code': sessionCode });
    });
  }

  void _requestRoomSize() {}

  String? _inferSourceFromLabels(List<String> labels) {
    final text = labels.join(' ').toLowerCase();
    if (text.contains('youtube')) return 'YouTube';
    if (text.contains('spotify')) return 'Spotify';
    if (text.contains('netflix')) return 'Netflix';
    if (text.contains('prime') || text.contains('amazon')) return 'Amazon Prime';
    if (text.contains('steam')) return 'Steam';
    if (text.contains('twitch')) return 'Twitch';
    if (text.contains('hulu')) return 'Hulu';
    if (text.contains('hotstar') || text.contains('disney')) return 'Disney+ Hotstar';
    return null;
  }

  String? _extractDomainFromLabels(List<String> labels) {
    final text = labels.join(' ');
    final regex = RegExp(r"[A-Za-z0-9.-]+\.[A-Za-z]{2,}");
    final m = regex.firstMatch(text);
    return m?.group(0);
  }

  Future<void> dispose() async {
    _socket?.dispose();
    await _pc?.close();
    await _pc?.dispose();
    for (final pc in _hostPcs.values) {
      await pc.close();
      await pc.dispose();
    }
    _hostPcs.clear();
    await _localStream?.dispose();
    await _remoteStream?.dispose();
    await _connectionStateCtrl.close();
    await _iceConnectionStateCtrl.close();
    await _remoteStreamCtrl.close();
    await _roomSizeCtrl.close();
    await _latencyMsCtrl.close();
    await _sourceCtrl.close();
    await _switchSuggestCtrl.close();
    _pingTimer?.cancel();
    _sourcePollTimer?.cancel();
    _activePageTimer?.cancel();
  }

  void _startSourcePolling() {
    _sourcePollTimer?.cancel();
    _sourcePollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_localStream == null) return;
      final labels = <String>[];
      for (final t in _localStream!.getTracks()) {
        final lbl = t.label;
        if (lbl != null && lbl.isNotEmpty) labels.add(lbl);
      }
      if (labels.isEmpty) return;
      final inferred = _inferSourceFromLabels(labels) ?? _extractDomainFromLabels(labels);
      if (inferred != null && inferred != _currentSource) {
        updateSource(inferred);
      }
    });
  }

  void _startActivePagePolling() {
    _activePageTimer?.cancel();
    _activePageTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!kIsWeb) return;
      if (role != PeerRole.host) return;
      if (_currentInput != HostInputType.tab) return;
      final bool isHidden = html.document.hidden ?? false;
      if (!isHidden) return;
      final now = DateTime.now();
      if (_lastSwitchSuggestAt != null && now.difference(_lastSwitchSuggestAt!).inSeconds < 15) return;
      _lastSwitchSuggestAt = now;
      _switchSuggestCtrl.add('another page or app');
    });
  }
}

enum HostInputType { mic, tab }
