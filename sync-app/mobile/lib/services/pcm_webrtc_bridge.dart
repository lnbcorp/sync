import 'dart:typed_data';
import 'webrtc_service.dart';

class PcmWebRTCBridge {
  final WebRTCService rtc;
  bool _started = false;

  PcmWebRTCBridge(this.rtc);

  Future<void> start() async {
    _started = true;
  }

  Future<void> stop() async {
    _started = false;
  }

  void enqueuePcm(Uint8List pcm) {
    if (!_started) return;
  }
}
