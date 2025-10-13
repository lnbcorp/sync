import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'services/audio_capture_service.dart';
import 'utils/opus_encoder.dart';
import 'services/webrtc_service.dart';
import 'models/peer_connection.dart';
import 'screens/home_screen.dart';
import 'config.dart' as cfg;

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'sync',
      theme: ThemeData.dark(useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(length: 2, vsync: this);

  // Capture demo state
  final _capture = AudioCaptureService();
  final _encoder = OpusEncoder();
  StreamSubscription<Uint8List>? _sub;
  bool _capturing = false;
  int _chunks = 0;
  int _bytes = 0;

  // WebRTC demo state
  final TextEditingController _codeCtrl = TextEditingController(text: '123456');
  PeerRole _role = PeerRole.host;
  WebRTCService? _rtc;
  RTCPeerConnectionState? _pcState;

  Future<void> _start() async {
    await _capture.requestPermission();
    final ok = await _capture.start();
    if (!ok) return;
    _sub = _capture.pcmStream().listen((pcm) {
      final encoded = _encoder.encodePcm(pcm);
      setState(() {
        _chunks += 1;
        _bytes += encoded.length;
      });
    });
    setState(() => _capturing = true);
  }

  Future<void> _stop() async {
    await _capture.stop();
    await _sub?.cancel();
    _encoder.dispose();
    setState(() => _capturing = false);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _encoder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('sync Demo'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'WebRTC'),
            Tab(text: 'Capture'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildWebRTCTab(),
          _buildCaptureTab(),
        ],
      ),
    );
  }

  Widget _buildCaptureTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Capturing: ${_capturing ? "Yes" : "No"}'),
          const SizedBox(height: 8),
          Text('Chunks: $_chunks'),
          Text('Bytes: $_bytes'),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _capturing ? null : _start,
                  child: const Text('Start'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _capturing ? _stop : null,
                  child: const Text('Stop'),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildWebRTCTab() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _codeCtrl,
            decoration: const InputDecoration(labelText: 'Session Code (6 digits)'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('Role:'),
              const SizedBox(width: 12),
              DropdownButton<PeerRole>(
                value: _role,
                onChanged: (v) => setState(() => _role = v ?? PeerRole.host),
                items: const [
                  DropdownMenuItem(value: PeerRole.host, child: Text('Host')),
                  DropdownMenuItem(value: PeerRole.listener, child: Text('Listener')),
                ],
              )
            ],
          ),
          const SizedBox(height: 12),
          Text('PC State: ${_pcState?.name ?? 'idle'}'),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: _rtc == null ? _startRtc : null,
                  child: const Text('Start Session'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: _rtc != null ? _stopRtc : null,
                  child: const Text('Stop Session'),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Future<void> _startRtc() async {
    final code = _codeCtrl.text.trim();
    if (code.length != 6) return;
    final rtc = WebRTCService(
      signalingUrl: cfg.signalingUrl,
      sessionCode: code,
      role: _role,
    );
    await rtc.init();
    if (_role == PeerRole.host) {
      await rtc.createAndAttachMicStream();
    }
    _rtc = rtc;
    _rtc!.connectionStateStream.listen((s) => setState(() => _pcState = s));
    setState(() {});
  }

  Future<void> _stopRtc() async {
    await _rtc?.dispose();
    setState(() {
      _rtc = null;
      _pcState = null;
    });
  }
}
