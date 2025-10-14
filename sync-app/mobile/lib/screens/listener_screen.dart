import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../models/peer_connection.dart';
import '../services/webrtc_service.dart';
import '../config.dart' as cfg;

class ListenerScreen extends StatefulWidget {
  const ListenerScreen({super.key});

  @override
  State<ListenerScreen> createState() => _ListenerScreenState();
}

class _ListenerScreenState extends State<ListenerScreen> {
  static const signalingUrl = cfg.signalingUrl; // legacy reference, use cfg.signalingUrl below

  final _codeCtrl = TextEditingController();
  WebRTCService? _rtc;
  RTCPeerConnectionState? _pcState;
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  bool _rendererReady = false;
  StreamSubscription<MediaStream>? _remoteSub;
  int? _roomSize;
  int? _latencyMs;
  StreamSubscription<int>? _roomSub;
  StreamSubscription<int>? _latSub;
  String? _source;
  StreamSubscription<String>? _sourceSub;

  @override
  void initState() {
    super.initState();
    _initRenderer();
  }

  Future<void> _initRenderer() async {
    await _remoteRenderer.initialize();
    _remoteRenderer.muted = false;
    setState(() => _rendererReady = true);
  }

  Future<void> _connect() async {
    final code = _codeCtrl.text.trim();
    if (code.length != 6) return;
    final rtc = WebRTCService(
      signalingUrl: cfg.signalingUrl,
      sessionCode: code,
      role: PeerRole.listener,
    );
    await rtc.init();
    rtc.connectionStateStream.listen((s) => setState(() => _pcState = s));
    _remoteSub?.cancel();
    _remoteSub = rtc.remoteStreamStream.listen((stream) {
      _remoteRenderer.srcObject = stream; // attach remote audio/video
      setState(() {});
    });
    _roomSub?.cancel();
    _latSub?.cancel();
    _roomSub = rtc.roomSizeStream.listen((v) => setState(() => _roomSize = v));
    _latSub = rtc.latencyMsStream.listen((v) => setState(() => _latencyMs = v));
    _sourceSub?.cancel();
    _sourceSub = rtc.sourceStream.listen((v) => setState(() => _source = v));
    setState(() => _rtc = rtc);
  }

  Future<void> _disconnect() async {
    _remoteRenderer.srcObject = null;
    await _remoteSub?.cancel();
    await _rtc?.dispose();
    setState(() {
      _rtc = null;
      _pcState = null;
    });
  }

  @override
  void dispose() {
    _remoteRenderer.dispose();
    _remoteSub?.cancel();
    _roomSub?.cancel();
    _latSub?.cancel();
    _sourceSub?.cancel();
    _rtc?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Listener')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _codeCtrl,
              decoration: const InputDecoration(labelText: 'Session Code (6 digits)'),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _rtc == null ? _connect : null,
                    child: const Text('Connect'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _rtc != null ? _disconnect : null,
                    child: const Text('Disconnect'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                _StatChip(label: 'Connection', value: _pcState?.name ?? 'idle'),
                const SizedBox(width: 12),
                _StatChip(label: 'Party', value: (_roomSize ?? (_rtc != null ? 2 : 0)).toString()),
                const SizedBox(width: 12),
                _StatChip(label: 'Latency', value: _latencyMs != null ? '${_latencyMs}ms' : '…'),
                const SizedBox(width: 12),
                _StatChip(label: 'Source', value: _source ?? '—'),
              ],
            ),
            const SizedBox(height: 12),
            if (_rendererReady)
              // For audio-only streams, this still enables playback on web/desktop/mobile
              Expanded(
                child: Container(
                  color: Colors.black12,
                  child: RTCVideoView(
                    _remoteRenderer,
                    mirror: false,
                    objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  const _StatChip({required this.label, required this.value});
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Chip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label: ', style: TextStyle(color: cs.onSurfaceVariant)),
          Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: cs.onSurface)),
        ],
      ),
      backgroundColor: Theme.of(context).cardColor,
      side: BorderSide(color: cs.primary.withOpacity(0.25)),
    );
  }
}
