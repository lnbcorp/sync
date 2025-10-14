import 'package:flutter/material.dart';
import 'host_screen.dart';
import 'listener_screen.dart';
import '../main.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('sync'),
        actions: [
          IconButton(
            tooltip: 'Toggle theme',
            icon: Icon(ThemeProvider.of(context).mode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode),
            onPressed: () => ThemeProvider.of(context).toggle(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            Center(
              child: SizedBox(
                height: 48,
                child: Image.asset(
                  Theme.of(context).brightness == Brightness.dark
                      ? 'assets/branding/logo-dark.png'
                      : 'assets/branding/logo-light.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const Spacer(),
            ElevatedButton(
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const HostScreen()),
              ),
              child: const Text('Start Party'),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ListenerScreen()),
              ),
              child: const Text('Join Party'),
            ),
            const Spacer(),
          ],
        ),
      ),
    );
  }
}
