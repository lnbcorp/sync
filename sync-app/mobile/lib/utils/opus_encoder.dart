import 'dart:typed_data';

/// Minimal placeholder Opus encoder interface.
/// Replace with a real implementation (e.g., using FFI) in later phases.
class OpusEncoder {
  final int sampleRate;
  final int channels;

  OpusEncoder({this.sampleRate = 48000, this.channels = 2});

  /// For now, passthrough PCM. Replace with real Opus encoding.
  Uint8List encodePcm(Uint8List pcm) {
    return pcm;
  }

  void dispose() {}
}
