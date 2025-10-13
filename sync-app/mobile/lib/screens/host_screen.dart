import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;
import '../models/peer_connection.dart';
import '../services/webrtc_service.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class HostScreen extends StatefulWidget {
  const HostScreen({super.key});

  @override
  State<HostScreen> createState() => _HostScreenState();
}

class _HostScreenState extends State<HostScreen> {
  static const signalingUrl = 'http://192.168.1.196:3000';

  String? _code;
  bool _starting = false;
  WebRTCService? _rtc;
  RTCPeerConnectionState? _pcState;

  Future<void> _createSession() async {
    setState(() => _starting = true);
    try {
      final res = await http.post(Uri.parse('$signalingUrl/api/session/create'));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final code = json['code'] as String;
        setState(() => _code = code);
      } else {
        _showSnack('Failed to create session: ${res.statusCode}');
      }
    } catch (e) {
      _showSnack('Error: $e');
    } finally {
      setState(() => _starting = false);
    }
  }

  Future<void> _startBroadcast() async {
    if (_code == null) {
      await _createSession();
      if (_code == null) return;
    }
    final rtc = WebRTCService(
      signalingUrl: signalingUrl,
      sessionCode: _code!,
      role: PeerRole.host,
    );
    await rtc.init();
    await rtc.createAndAttachMicStream();
    rtc.connectionStateStream.listen((s) => setState(() => _pcState = s));
    setState(() => _rtc = rtc);
  }

  Future<void> _startBroadcastWithTabAudioWeb() async {
    if (!kIsWeb) return;
    if (_code == null) {
      await _createSession();
      if (_code == null) return;
    }
    final rtc = WebRTCService(
      signalingUrl: signalingUrl,
      sessionCode: _code!,
      role: PeerRole.host,
    );
    await rtc.init();
    final s = await rtc.createAndAttachTabAudioStreamWeb();
    if (s == null) return; // user canceled picker
    rtc.connectionStateStream.listen((s) => setState(() => _pcState = s));
    setState(() => _rtc = rtc);
  }

  Future<void> _stopBroadcast() async {
    await _rtc?.dispose();
    setState(() {
      _rtc = null;
      _pcState = null;
    });
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _rtc?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Host')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 16),
            if (_code != null) ...[
              Text('Session Code', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              SelectableText(_code!, style: const TextStyle(fontSize: 32, letterSpacing: 4)),
            ] else ...[
              const Text('Tap "Start" to create a session code')
            ],
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _rtc == null && !_starting ? _startBroadcast : null,
                    child: _starting ? const Text('Starting...') : const Text('Start'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _rtc != null ? _stopBroadcast : null,
                    child: const Text('Stop'),
                  ),
                ),
              ],
            ),
            if (kIsWeb) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _rtc == null && !_starting ? _startBroadcastWithTabAudioWeb : null,
                      icon: const Icon(Icons.tab),
                      label: const Text('Start with Tab Audio (Web)'),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Connection: ${_pcState?.name ?? 'idle'}'),
            )
          ],
        ),
      ),
    );
  }
}
