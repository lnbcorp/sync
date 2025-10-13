# Demo Setup Guide (Web UI + Optional Signaling)

This guide explains, in simple steps, how anyone can clone, set up, and run the demo UI in a browser, and how to configure values (e.g., signaling server URL) so remote users can connect.

It covers three ways to run:
- Local-only (fastest) for development
- Local with tunnels (share demo externally without full deploy)
- Production-like (build Flutter Web and host the static site, with a reachable signaling server)

---

## 1) Prerequisites

- Flutter SDK (3.24+)
  - Verify: `flutter --version`
- Google Chrome (for web demo)
- Node.js 18+ (only if you plan to run the signaling server locally)
- pnpm (only if you plan to run the signaling server locally)
  - Install: `npm install -g pnpm` (PowerShell as Administrator may be needed)

Optional (for easy external sharing without deploy):
- ngrok OR Cloudflare Tunnel (one of them)

---

## 2) Repo Structure (relevant parts)

- `sync-app/mobile/` – Flutter application (Web UI and Android app)
- `sync-app/backend/` – Signaling server (Node + Socket.io). Dev mode supports in-memory sessions (no Redis needed)

---

## 3) Quick Start: Local Web UI Only

You can run only the UI to see screens and flow. Real-time audio requires a reachable signaling server (see sections below), but the UI itself runs without it.

```powershell
# From repo root
cd sync-app/mobile
flutter pub get
flutter run -d chrome
```

This launches the web app on a local URL, e.g. `http://localhost:xxxxx/`.

- Host screen: Start Party (mic) or Start with Tab Audio (Web)
- Listener screen: Join Party with the same 6-digit session code

If you want audio to actually stream between two browsers, also run the signaling server.

---

## 4) Run Signaling Server Locally (for actual audio streaming)

```powershell
# From repo root
cd sync-app/backend
pnpm install
pnpm dev
```

Notes:
- The backend is configured to use an in-memory session store by default (no Redis required in dev).
- Health check: `http://localhost:3000/health` → `{ ok: true }`

Now point the UI to this server (see Section 6 to change the signaling URL).

---

## 5) Important Values You Must Configure

There are a few hardcoded placeholders you may need to change. Here’s where they are and how to set them.

- **Signaling Server URL**
  - Where it appears:
    - `sync-app/mobile/lib/screens/host_screen.dart` → `static const signalingUrl`
    - `sync-app/mobile/lib/screens/listener_screen.dart` → `static const signalingUrl`
    - `sync-app/mobile/lib/main.dart` (only if using the dev WebRTC tab) → `signalingUrl` in `_startRtc()`
  - What to set:
    - For local dev: `http://localhost:3000` (or your LAN IP, e.g., `http://192.168.1.xxx:3000`)
    - For tunnels: the HTTPS URL printed by ngrok/Cloudflare Tunnel (e.g., `https://abc.ngrok-free.app`)
    - For production: your real backend URL (e.g., `https://signaling.yourdomain.com`)
  - How to find the value:
    - If using tunnels, copy the HTTPS forwarding URL from your tunnel CLI output.
    - If using a public backend, use your deployed domain.

- **ICE Servers (STUN/TURN)**
  - Where it appears:
    - `sync-app/mobile/lib/models/peer_connection.dart` → `PeerConnectionConfig.iceServers`
  - Default uses Google STUN only. For cross-network reliability, add TURN:
    ```dart
    const PeerConnectionConfig({
      this.iceServers = const [
        { 'urls': 'stun:stun.l.google.com:19302' },
        // Replace with your TURN server for production demos
        { 'urls': 'turns:turn.yourdomain.com:5349', 'username': 'syncuser', 'credential': 'syncpass' }
      ]
    });
    ```
  - How to get TURN:
    - Easiest: use a hosted TURN provider (Twilio/Nimble Ape/etc.).
    - Or self-host `coturn` on a VPS with TLS (port 5349).

- **HTTPS requirement**
  - For web/tab audio capture, the site must be served via HTTPS (localhost is special-cased). Tunnels or hosted static sites (Netlify/Vercel/Pages) solve this.

- **Flutter Web base path (if hosting under a subpath)**
  - If you host on GitHub Pages at `https://username.github.io/repo/`, build with:
    ```powershell
    flutter build web --release --base-href /repo/
    ```
  - Then deploy `sync-app/mobile/build/web/` to Pages or your static host.

---

## 6) Recommended: Use Build-Time Defines (avoid editing source per environment)

Instead of hardcoding `signalingUrl`, switch to a config constant that reads from a build-time define.

1) Create a config constant (example):
```dart
// sync-app/mobile/lib/config.dart
const signalingUrl = String.fromEnvironment('SIGNALING_URL', defaultValue: 'http://localhost:3000');
```

2) Import and use it in:
- `sync-app/mobile/lib/screens/host_screen.dart`
- `sync-app/mobile/lib/screens/listener_screen.dart`
- (Optional) `sync-app/mobile/lib/main.dart` if using the dev WebRTC tab

3) Run/build with a URL override:
```powershell
# Dev run
flutter run -d chrome --dart-define=SIGNALING_URL=https://your-backend.example.com

# Production build
flutter build web --release --dart-define=SIGNALING_URL=https://your-backend.example.com
```

This keeps the repo clean and portable.

---

## 7) End-to-End Demo Flows

- **Local (same machine)**
  1. Start backend: `pnpm dev` in `sync-app/backend/`
  2. Start UI: `flutter run -d chrome` in `sync-app/mobile/`
  3. Open another Chrome window as Listener.
  4. Host → create session (Start) → Allow mic or choose Tab Audio.
  5. Listener → enter code → Connect.

- **External (tunnels)**
  1. Start backend locally: `pnpm dev` (port 3000)
  2. Tunnel backend: `cloudflared tunnel --url http://localhost:3000` (copy HTTPS URL)
  3. Start Flutter web on port 8080 and tunnel it too (optional):
     - `flutter run -d chrome --web-hostname 0.0.0.0 --web-port 8080`
     - `cloudflared tunnel --url http://localhost:8080`
  4. Set `signalingUrl` to the backend tunnel URL (Section 6 or 7).
  5. Share the tunneled UI URL with others.

- **Hosted Web UI + Hosted Backend (recommended for public demos)**
  1. Build web: `flutter build web --release`
  2. Deploy `sync-app/mobile/build/web/` to Netlify/Vercel/Pages (HTTPS)
  3. Deploy backend (Render/Railway/Fly.io/VPS) → use HTTPS
  4. Set `SIGNALING_URL` (Section 7) to your backend domain
  5. Add TURN in `iceServers` for reliability

---

## 8) Troubleshooting

- **Chrome shows no audio on Listener**
  - Ensure Host added a track before creating offer (our flow does this).
  - Ensure you used the Listener screen and entered the same 6-digit code.
  - Check that both show `Connection: connected`.
  - For tab audio: in the sharing dialog, pick the **Tab** and check **Share tab audio**.

- **P2P doesn’t connect across networks**
  - Add a TURN server in `iceServers`.
  - Ensure signaling URL is reachable via HTTPS from both peers.

- **PowerShell curl error**
  - Use one of:
    ```powershell
    Invoke-RestMethod -Uri "http://localhost:3000/api/session/create" -Method Post
    # or force native curl
    curl.exe -X POST http://localhost:3000/api/session/create
    ```

---

## 9) Security & Production Notes

- Don’t commit real TURN credentials to public repos.
- Use HTTPS everywhere (frontend + backend).
- For production, use a real Redis instead of in-memory sessions.
- Consider auth/rate-limiting for the signaling server.

---

## 10) Where to Edit Values (Quick Reference)

- **Signaling URL**
  - `sync-app/mobile/lib/screens/host_screen.dart` → `signalingUrl`
  - `sync-app/mobile/lib/screens/listener_screen.dart` → `signalingUrl`
  - `sync-app/mobile/lib/main.dart` (WebRTC dev tab)
  - Prefer using `lib/config.dart` + `--dart-define` (Section 7)

- **ICE Servers (STUN/TURN)**
  - `sync-app/mobile/lib/models/peer_connection.dart` → `PeerConnectionConfig`

- **Backend CORS / Port**
  - `sync-app/backend/src/server.js` → `CORS_ORIGIN`, `PORT`, `REDIS_URL`
