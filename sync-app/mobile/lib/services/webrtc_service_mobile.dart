import 'dart:async';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/services.dart';
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

  Stream<RTCPeerConnectionState> get connectionStateStream => _connectionStateCtrl.stream;
  Stream<RTCIceConnectionState> get iceConnectionStateStream => _iceConnectionStateCtrl.stream;
  Stream<MediaStream> get remoteStreamStream => _remoteStreamCtrl.stream;
  Stream<int> get roomSizeStream => _roomSizeCtrl.stream;
  Stream<int> get latencyMsStream => _latencyMsCtrl.stream;
  Stream<String> get sourceStream => _sourceCtrl.stream;

  // Platform channel for native capture control
  static const MethodChannel _chan = MethodChannel('sync_mobile/webrtc');

  WebRTCService({
    required this.signalingUrl,
    required this.sessionCode,
    required this.role,
    this.config = const PeerConnectionConfig(),
  });

  Future<void> init() async {
    _socket = IO.io(signalingUrl, IO.OptionBuilder().setTransports(['websocket']).build());
    _socket!.onConnect((_) => _socket!.emit('join', { 'code': sessionCode }));
    _socket!.on('room-size', (data) {
      final map = Map<String, dynamic>.from(data as Map);
      final size = (map['size'] ?? 0) as int;
      _roomSizeCtrl.add(size);
    });
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
      if (src is String) _sourceCtrl.add(src);
    });
    // NOTE: Full Android/iOS capture to be implemented via platform channels
  }

  void updateSource(String source) {
    _socket?.emit('source-update', { 'code': sessionCode, 'source': source });
    _sourceCtrl.add(source);
  }

  // Placeholder: Android/iOS-specific background capture will be implemented via platform channels
  Future<bool> requestBackgroundCapturePermissions() async {
    try {
      final ok = await _chan.invokeMethod<bool>('requestPermissions');
      return ok ?? false;
    } on PlatformException catch (e) {
      // surface error via logs if needed
      return false;
    }
  }

  Future<bool> startBackgroundAudioCapture() async {
    try {
      final ok = await _chan.invokeMethod<bool>('startBackgroundAudioCapture', {
        'sessionCode': sessionCode,
        'role': role.name,
      });
      return ok ?? false;
    } on PlatformException catch (e) {
      return false;
    }
  }

  Future<void> stopBackgroundAudioCapture() async {
    try {
      await _chan.invokeMethod('stopBackgroundAudioCapture');
    } catch (_) {}
  }

  // Kept for API parity with web; not supported on mobile yet
  Future<MediaStream?> createAndAttachTabAudioStreamWeb() async => throw UnimplementedError('Not supported on mobile');
  Future<bool> switchToTabAudioWeb() async => throw UnimplementedError('Not supported on mobile');

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
  }
}
