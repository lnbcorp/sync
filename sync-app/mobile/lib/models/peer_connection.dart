import 'package:flutter_webrtc/flutter_webrtc.dart';

typedef OnConnectionState = void Function(RTCPeerConnectionState state);
typedef OnIceConnectionState = void Function(RTCIceConnectionState state);
typedef OnIceCandidate = void Function(RTCIceCandidate candidate);

enum PeerRole { host, listener }

class PeerConnectionConfig {
  final List<Map<String, dynamic>> iceServers;
  const PeerConnectionConfig({this.iceServers = const [
    { 'urls': 'stun:stun.l.google.com:19302' }
  ]});
}
