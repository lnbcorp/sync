# 🪩 PRD: sync – Cross-Platform Music Streaming System

**Version:** v1.1  
**Date:** 12 October 2025  
**Author:** Anmol Vats  

---

## 1. Overview

### Product Name
**sync**

### Tagline
**“One Host, Multiple Devices, Perfect Sync for Any Audio.”**

### Description
sync transforms a group of smartphones or computers into a perfectly synchronized wireless speaker network.  
One user (Host) plays any audio content (YouTube, Spotify, Netflix, local files, etc.), and others (Listeners) join in to hear the exact same sound **in perfect sync** — like turning everyone’s devices into a shared surround-sound experience.

Now expanded to include:
- **Mobile App:** Android + iOS (via Flutter)
- **Web App:** Cross-platform web version for browser-based participation (React or Flutter Web)

---

## 2. Problem Statement

When people are outdoors, traveling, or hanging out, it’s often impractical to carry speakers or share a single device’s audio.  
Users need a **cross-platform, wireless, synchronized** solution that leverages their own devices to play audio together, without extra hardware or delays.

---

## 3. Key Goals & Objectives

| Goal | Description |
|------|--------------|
| **Universal Compatibility** | Works seamlessly on Android, iOS, and Web browsers |
| **Low Latency** | Maintain <100ms end-to-end delay |
| **Cross-Platform Audio Streaming** | Works across all popular sources (Spotify, YouTube, Netflix, etc.) |
| **Scalable** | Support 10+ connected listeners |
| **Ease of Use** | Start/Join Party in 2 taps |
| **Future Extensibility** | Support for multi-headphone broadcast and web integration |

---

## 4. Target Use Cases

1. **Outdoor Group Listening (Trekking, Camping, Picnics)**  
   Everyone’s phones act as speakers playing the same music.
2. **Bus or Train Rides**  
   Watch videos or comedy clips together — same video, synced sound.
3. **Gaming Audio Sharing**  
   Stream game sound to teammates nearby.
4. **Study Sessions / Podcasts**  
   Listen to podcasts or lectures together without delay.
5. **Social Media Reels / Watch Parties**  
   Share short-form content (YouTube, TikTok) in sync.

---

## 5. Core User Roles

### **Host (Broadcaster)**
- Starts a new “Party Session.”
- Plays music or video.
- Controls playback (play/pause/next/volume).
- Shares 6-digit connection code or QR code.

### **Listener (Receiver)**
- Enters or scans code to join.
- Hears the same audio in sync.
- Can see “Now Playing” and vote in polls for next track.

---

## 6. User Flow

### Host Flow
1. Open app → Tap **“Start Party”**  
2. Select source (Spotify, YouTube, Local file)  
3. Stream begins → App captures audio  
4. Generate & share 6-digit session code  
5. View connected devices + latency stats  
6. Control playback and end session  

### Listener Flow
1. Open app → Tap **“Join Party”**  
2. Enter 6-digit code  
3. Connect to Host → Buffer and sync audio  
4. Playback begins in sync  
5. Optionally vote or interact (poll feature)

---

## 7. Platform Scope

| Platform | Type | Tech Stack | Description |
|-----------|------|-------------|--------------|
| **Android** | Mobile | Flutter + Dart | Uses AudioPlaybackCapture API |
| **iOS** | Mobile | Flutter + Dart | Uses in-app playback via AVAudioEngine |
| **Web** | Web App | React.js (or Flutter Web) + WebRTC | Enables browser-based joining and broadcasting |

---

## 8. Technical Architecture

### 8.1 Audio Pipeline

| Stage | Description |
|--------|--------------|
| **Capture** | AudioPlaybackCapture (Android), AVAudioEngine (iOS), WebAudio API (Web) |
| **Encoding** | Opus Codec (48kHz, 64–128 kbps adaptive) |
| **Transport** | WebRTC P2P streaming (UDP), fallback to TCP sockets |
| **Sync Logic** | NTP or WebRTC timestamp-based synchronization |
| **Playback** | Low-latency player (flutter_sound / Web Audio API) |

---

### 8.2 Backend Architecture

| Component | Tech Stack | Purpose |
|------------|-------------|----------|
| **Signaling Server** | Node.js + Express + Socket.io | Handles WebRTC handshakes, room codes |
| **Media Server (Optional)** | Janus / Kurento | Relay stream if P2P fails |
| **Database** | Redis (sessions) + PostgreSQL (users, sessions, feedback) |
| **Hosting** | AWS / GCP using Docker |
| **API Gateway** | REST + WebSocket endpoints for room/session management |

---

### 8.3 WebRTC Configuration

- **STUN/TURN** for connection negotiation  
- **DTLS-SRTP** encryption for secure audio transmission  
- **Auto-Reconnect + Resync** logic for dropped connections  

---

## 9. Synchronization Strategy

- Host and listeners synchronize via **NTP** or **WebRTC timestamp alignment**  
- 50–100ms buffer window per device  
- Continuous **drift correction** using adaptive timestamp adjustment  
- Latency visualization (Host dashboard shows device delay in ms)

---

## 10. UI/UX Design (Initial Mockup)

### Host UI
- “Start Party” Button  
- Source Selector (Spotify, YouTube, Local)  
- QR Code + Session Code display  
- Connected Devices List  
- Playback Controls (Play/Pause, Skip, Volume)  
- Stream Status Indicator (e.g., latency, quality)

### Listener UI
- “Join Party” Field (code or QR)  
- Connection Status Animation  
- Live Track Info (title, artist, duration)  
- Latency & Quality Display  
- Optional Polling Screen (Vote next song)

---

## 11. Development Stack Summary

| Layer | Tech | Notes |
|--------|------|-------|
| **Frontend (Mobile)** | Flutter (Dart) | Shared for Android/iOS |
| **Frontend (Web)** | React.js or Flutter Web | WebRTC streaming support |
| **Backend** | Node.js + Express + Socket.io | Handles signaling, sessions, APIs |
| **Media** | WebRTC (P2P), Janus/Kurento (relay) | Real-time streaming |
| **Database** | Redis + PostgreSQL | Caching + user/session data |
| **CI/CD** | GitHub Actions | Automated testing/deployment |
| **Monitoring** | Firebase + Crashlytics | App health + performance tracking |

---

## 12. Roadmap

### **Phase 1 – MVP**
- One Host → One Listener (P2P)
- Local WiFi-only streaming
- Basic Opus audio compression
- Flutter Mobile Prototype + Basic Web Frontend

### **Phase 2 – Multi-Device Sync**
- Multiple listeners  
- Clock synchronization  
- Better buffering logic  
- UI for connected devices  
- Local + Internet support  

### **Phase 3 – Web Integration**
- Web app parity with mobile app  
- React.js/Flutter Web client for joining or broadcasting  
- Browser-based session creation and listening  

### **Phase 4 – Production Polish**
- Spotify / YouTube API integration  
- Full Host dashboard (polls, votes, analytics)  
- Error handling, reconnection, adaptive bitrate

---

## 13. Performance Targets

| Metric | Target |
|--------|---------|
| **End-to-End Latency** | <100ms |
| **Sync Drift Between Devices** | <25ms |
| **Audio Quality** | 48kHz Opus @ 64–128kbps |
| **Battery Drain** | <10% per hour |
| **Concurrent Listeners (MVP)** | 10 |

---

## 14. Security & Privacy

- Secure WebRTC connections via **DTLS-SRTP**
- HTTPS for all APIs
- Session codes expire automatically
- No persistent storage of audio data
- Encrypted device identifiers for connection logs

---

## 15. Proof of Concept Deliverables

1. **Functional Audio Sync Demo** (Mobile + Web)  
2. **Latency Metrics Dashboard**  
3. **Host/Listener Connection UI**  
4. **Multi-Listener Prototype (6 devices)**  
5. **Error Handling + Reconnection Logic**

---

## 16. Future Expansion Ideas

- Internet-wide streaming via TURN relay  
- Chromecast / Smart Speaker integration  
- Wearable audio device compatibility  
- Local discovery via mDNS or Bluetooth  
- Voice chat integration for real-time “party talk”

---

## 17. Success Criteria

✅ Real-time audio sync across mobile & web  
✅ Sub-100ms latency with no noticeable delay  
✅ Stable sessions up to 10 devices  
✅ Smooth host/guest UI experience  
✅ Secure connections & recoverable sessions  

---

## 18. References

- Android AudioPlaybackCapture API  
- iOS AVAudioEngine Documentation  
- WebRTC RFCs 5245 / 5763 / 8827  
- Opus Codec Specification (RFC 6716)  
- Auracast (Bluetooth LE Audio Broadcast) Docs

---

> **Summary:**  
> sync aims to revolutionize shared audio experiences by turning everyone’s phone, laptop, or tablet into a synchronized sound system.  
> The MVP focuses on reliable local streaming and cross-platform sync, while later phases explore advanced features like multi-headphone broadcasting and full web participation.

