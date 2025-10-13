import 'dart:async';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../models/peer_connection.dart';

class WebRTCService {
  final String signalingUrl;
  final String sessionCode;
  final PeerRole role;
  final PeerConnectionConfig config;

  IO.Socket? _socket;
  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  String? _remoteSocketId;

  final _connectionStateCtrl = StreamController<RTCPeerConnectionState>.broadcast();
  final _iceConnectionStateCtrl = StreamController<RTCIceConnectionState>.broadcast();
  final _remoteStreamCtrl = StreamController<MediaStream>.broadcast();

  Stream<RTCPeerConnectionState> get connectionStateStream => _connectionStateCtrl.stream;
  Stream<RTCIceConnectionState> get iceConnectionStateStream => _iceConnectionStateCtrl.stream;
  Stream<MediaStream> get remoteStreamStream => _remoteStreamCtrl.stream;

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

    _socket!.on('offer', (data) async {
      if (role == PeerRole.listener) {
        await _ensurePeerConnection();
        final sdpMap = Map<String, dynamic>.from(data as Map);
        final sdp = sdpMap['sdp'];
        _remoteSocketId = sdpMap['from'] as String?; // remember who sent the offer
        await _pc!.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
        final answer = await _pc!.createAnswer();
        await _pc!.setLocalDescription(answer);
        _socket!.emit('answer', { 'code': sessionCode, 'sdp': answer.toMap(), 'to': _remoteSocketId });
      }
    });

    _socket!.on('answer', (data) async {
      if (role == PeerRole.host) {
        final sdpMap = Map<String, dynamic>.from(data as Map);
        final sdp = sdpMap['sdp'];
        await _pc!.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
      }
    });

    _socket!.on('ice-candidate', (data) async {
      final map = Map<String, dynamic>.from(data as Map);
      final c = map['candidate'];
      final cand = RTCIceCandidate(c['candidate'], c['sdpMid'], c['sdpMLineIndex']);
      await _pc?.addCandidate(cand);
    });

    _socket!.on('request-offer', (data) async {
      if (role != PeerRole.host) return;
      final map = Map<String, dynamic>.from(data as Map);
      final to = map['to'];
      if (to == null) return;
      _remoteSocketId = to; // route subsequent ICE to this peer
      await _ensurePeerConnection();
      // Create a fresh offer targeting the new peer
      final offer = await _pc!.createOffer({
        'offerToReceiveAudio': 1,
        'offerToReceiveVideo': 0,
      });
      await _pc!.setLocalDescription(offer);
      _socket!.emit('offer', { 'code': sessionCode, 'sdp': offer.toMap(), 'to': to });
    });

    // Host will create and send offer after attaching local stream.
  }

  Future<void> attachLocalStream(MediaStream stream) async {
    _localStream = stream;
    await _ensurePeerConnection();
    for (var track in stream.getTracks()) {
      await _pc!.addTrack(track, stream);
    }
    if (role == PeerRole.host) {
      final offer = await _pc!.createOffer({
        'offerToReceiveAudio': 1,
        'offerToReceiveVideo': 0,
      });
      await _pc!.setLocalDescription(offer);
      _socket?.emit('offer', { 'code': sessionCode, 'sdp': offer.toMap() });
    }
  }

  Future<MediaStream> createAndAttachMicStream() async {
    final mediaConstraints = {
      'audio': true,
      'video': false,
    };
    final stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    await attachLocalStream(stream);
    return stream;
  }

  Future<MediaStream?> createAndAttachTabAudioStreamWeb() async {
    if (!kIsWeb) return null;
    final constraints = {
      'audio': true,
      'video': true, // request video to ensure tab-audio is permitted, we'll drop it below
    };
    final stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    // Ensure only audio tracks are added
    for (final t in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
      await t.stop();
      stream.removeTrack(t);
    }
    await attachLocalStream(stream);
    return stream;
  }

  Future<void> _ensurePeerConnection() async {
    if (_pc != null) return;
    final Map<String, dynamic> iceConfiguration = {
      'iceServers': config.iceServers,
      'sdpSemantics': 'unified-plan',
      'bundlePolicy': 'max-bundle',
    };
    _pc = await createPeerConnection(iceConfiguration);

    // Pre-create a remote stream container for platforms that require a concrete instance.
    _remoteStream ??= await createLocalMediaStream('remote');

    // Ensure listener is prepared to receive audio
    if (role == PeerRole.listener) {
      await _pc!.addTransceiver(
        kind: RTCRtpMediaType.RTCRtpMediaTypeAudio,
        init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
      );
    }

    _pc!.onConnectionState = (state) {
      // ignore: avoid_print
      print('[WebRTC] connectionState=${state.name}');
      _connectionStateCtrl.add(state);
    };
    _pc!.onIceConnectionState = (state) {
      // ignore: avoid_print
      print('[WebRTC] iceConnectionState=${state.name}');
      _iceConnectionStateCtrl.add(state);
    };
    _pc!.onIceCandidate = (candidate) {
      if (candidate.candidate != null) {
        final payload = { 'code': sessionCode, 'candidate': candidate.toMap() };
        if (_remoteSocketId != null) {
          payload['to'] = _remoteSocketId;
        }
        // ignore: avoid_print
        print('[WebRTC] emit ice-candidate to=${payload['to'] ?? 'room'}');
        _socket?.emit('ice-candidate', payload);
      }
    };
    _pc!.onTrack = (event) {
      // ignore: avoid_print
      print('[WebRTC] onTrack kind=${event.track.kind} streams=${event.streams.length}');
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

  Future<void> dispose() async {
    _socket?.dispose();
    await _pc?.close();
    await _pc?.dispose();
    await _localStream?.dispose();
    await _remoteStream?.dispose();
    await _connectionStateCtrl.close();
    await _iceConnectionStateCtrl.close();
    await _remoteStreamCtrl.close();
  }
}
