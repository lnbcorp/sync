import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'services/audio_capture_service.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'utils/opus_encoder.dart';
import 'services/webrtc_service.dart';
import 'models/peer_connection.dart';
import 'screens/home_screen.dart';
import 'config.dart' as cfg;

void main() {
  runApp(const MyApp());
}

class ThemeController extends ChangeNotifier {
  ThemeMode _mode = ThemeMode.dark;
  ThemeMode get mode => _mode;
  void toggle() {
    _mode = _mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
  }
}

class ThemeProvider extends InheritedNotifier<ThemeController> {
  const ThemeProvider({super.key, required ThemeController controller, required Widget child})
      : super(notifier: controller, child: child);
  static ThemeController of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<ThemeProvider>()!.notifier!;
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final _theme = ThemeController();

  ThemeData _lightTheme() {
    const seed = Color(0xFF0D47A1); // deep blue
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: Brightness.light,
      ).copyWith(background: Colors.white, surface: Colors.white, primaryContainer: Colors.blue.shade50),
      scaffoldBackgroundColor: Colors.white, // exact match to light logo bg
      appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: Colors.black),
      cardColor: Colors.grey.shade100,
    );
  }

  ThemeData _darkTheme() {
    const seed = Color(0xFF1565C0); // blue
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: Brightness.dark,
      ).copyWith(background: Colors.black, surface: const Color(0xFF0A0A0A)),
      scaffoldBackgroundColor: Colors.black, // exact match to dark logo bg
      appBarTheme: const AppBarTheme(backgroundColor: Colors.black, foregroundColor: Colors.white),
      cardColor: const Color(0xFF121212),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ThemeProvider(
      controller: _theme,
      child: AnimatedBuilder(
        animation: _theme,
        builder: (context, _) {
          return MaterialApp(
            title: 'sync',
            theme: _lightTheme(),
            darkTheme: _darkTheme(),
            themeMode: _theme.mode,
            debugShowCheckedModeBanner: false,
            builder: (context, child) {
              if (!kDebugMode || child == null) return child ?? const SizedBox.shrink();
              return Stack(
                children: [
                  child,
                  const Positioned(
                    right: 0,
                    bottom: 0,
                    child: Banner(message: 'DEBUG', location: BannerLocation.bottomEnd),
                  ),
                ],
              );
            },
            home: const HomeScreen(),
          );
        },
      ),
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
      await rtc.switchToTabAudioWeb();
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
