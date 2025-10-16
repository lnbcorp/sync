import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;
import '../models/peer_connection.dart';
import '../services/webrtc_service.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../config.dart' as cfg;

class HostScreen extends StatefulWidget {
  const HostScreen({super.key});

  @override
  State<HostScreen> createState() => _HostScreenState();
}

class _HostScreenState extends State<HostScreen> {

  String? _code;
  bool _starting = false;
  WebRTCService? _rtc;
  RTCPeerConnectionState? _pcState;
  int? _roomSize;
  int? _latencyMs;
  StreamSubscription<int>? _roomSub;
  StreamSubscription<int>? _latSub;
  String? _source;
  StreamSubscription<String>? _sourceSub;
  StreamSubscription<String>? _switchSuggestSub;

  Future<void> _createSession() async {
    setState(() => _starting = true);
    try {
      final res = await http.post(Uri.parse('${cfg.signalingUrl}/api/session/create'));
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

  void _handleSwitchSuggestion(String hostname) async {
    if (!mounted) return;
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Switch audio source?'),
        content: Text('Detected active page "$hostname". Do you want to share its audio instead?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Not now')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Switch')),
        ],
      ),
    );
    if (res == true) {
      await _rtc?.switchToTabAudioWeb();
    }
  }

  Future<void> _startBroadcast() async {
    // Delegate to Screen/Tab audio start to avoid mic usage
    await _startBroadcastWithTabAudioWeb();
  }

  Future<void> _startBroadcastWithTabAudioWeb() async {
    if (!kIsWeb) return;
    if (_code == null) {
      await _createSession();
      if (_code == null) return;
    }
    final rtc = WebRTCService(
      signalingUrl: cfg.signalingUrl,
      sessionCode: _code!,
      role: PeerRole.host,
    );
    await rtc.init();
    final s = await rtc.createAndAttachTabAudioStreamWeb();
    if (s == null) return; // user canceled picker
    rtc.connectionStateStream.listen((s) => setState(() => _pcState = s));
    _roomSub?.cancel();
    _latSub?.cancel();
    _sourceSub?.cancel();
    _switchSuggestSub?.cancel();
    _roomSub = rtc.roomSizeStream.listen((v) => setState(() => _roomSize = v));
    _latSub = rtc.latencyMsStream.listen((v) => setState(() => _latencyMs = v));
    _sourceSub = rtc.sourceStream.listen((v) => setState(() => _source = v));
    _switchSuggestSub = rtc.switchSuggestionStream.listen(_handleSwitchSuggestion);
    setState(() => _rtc = rtc);
  }

  Future<void> _stopBroadcast() async {
    await _rtc?.dispose();
    setState(() {
      _rtc = null;
      _pcState = null;
      _source = null;
    });
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _roomSub?.cancel();
    _latSub?.cancel();
    _sourceSub?.cancel();
    _switchSuggestSub?.cancel();
    _rtc?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: SizedBox(
          height: 28,
          child: Image.asset(
            Theme.of(context).brightness == Brightness.dark
                ? 'assets/branding/logo-dark.png'
                : 'assets/branding/logo-light.png',
            fit: BoxFit.contain,
          ),
        ),
      ),
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
            if (_rtc == null) ...[
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _rtc == null && !_starting ? _startBroadcastWithTabAudioWeb : null,
                      icon: const Icon(Icons.tab),
                      label: const Text('Start (Share Screen/Tab Audio)'),
                    ),
                  ),
                ],
              ),
            ] else ...[
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: (!_starting && kIsWeb) ? () async {
                        final ok = await _rtc?.switchToTabAudioWeb() ?? false;
                        if (!ok) {
                          _showSnack('No audio captured. Select Entire screen and enable Share system audio.');
                        }
                      } : null,
                      icon: const Icon(Icons.tab),
                      label: const Text('Switch to Screen/Tab Audio'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _rtc != null ? _stopBroadcast : null,
                      child: const Text('Stop'),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                _StatChip(label: 'Connection', value: _pcState?.name ?? 'idle'),
                const SizedBox(width: 12),
                _StatChip(label: 'Party', value: (_roomSize ?? 1).toString()),
                const SizedBox(width: 12),
                _StatChip(label: 'Latency', value: _latencyMs != null ? '${_latencyMs}ms' : '…'),
                const SizedBox(width: 12),
                _StatChip(label: 'Source', value: _source ?? '—'),
              ],
            ),
            const SizedBox(height: 8),
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
