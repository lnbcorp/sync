import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';

class AudioCaptureService {
  static const MethodChannel _method = MethodChannel('audio_capture');
  static const EventChannel _events = EventChannel('audio_capture_stream');

  Stream<Uint8List>? _stream;

  bool get _isAndroid => defaultTargetPlatform == TargetPlatform.android;

  Future<void> requestPermission() async {
    if (!_isAndroid) return; // no-op on non-Android targets
    await _method.invokeMethod('requestPermission');
  }

  Future<bool> start({int sampleRate = 48000, int channelCount = 2}) async {
    if (!_isAndroid) return false;
    final ok = await _method.invokeMethod<bool>('start', {
      'sampleRate': sampleRate,
      'channelCount': channelCount,
    });
    return ok ?? false;
  }

  Future<void> stop() async {
    if (!_isAndroid) return;
    await _method.invokeMethod('stop');
  }

  Stream<Uint8List> pcmStream() {
    if (!_isAndroid) {
      // return an empty broadcast stream on non-Android platforms
      return const Stream<Uint8List>.empty();
    }
    _stream ??= _events.receiveBroadcastStream().map((e) => e as Uint8List);
    return _stream!;
  }
}
