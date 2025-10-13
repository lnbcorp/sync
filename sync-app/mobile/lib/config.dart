// Build-time configurable constants
// Override with: --dart-define=SIGNALING_URL=https://your-backend.example.com

const signalingUrl = String.fromEnvironment(
  'SIGNALING_URL',
  defaultValue: 'http://localhost:3000',
);
