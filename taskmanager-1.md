## 📋 **PHASE 0: Foundation & Setup**
*Duration: 2-3 days | AI Context: Infrastructure*

### Tasks:
1. **Repository Structure**
   ```
   /sync-app
   ├── /mobile (Flutter)
   ├── /web (React.js)
   ├── /backend (Node.js)
   ├── /shared (Common types/interfaces)
   └── /docs (Architecture diagrams)
   ```
   **AI Prompt**: "Create a monorepo structure for a cross-platform audio streaming app with Flutter mobile, React web, and Node.js backend. Include Docker configs, ESLint, Prettier, and TypeScript setup."

2. **Development Environment**
   - Docker Compose for local backend + Redis + PostgreSQL
   - Flutter SDK setup script
   - Node.js 20+ with pnpm
   
   **AI Prompt**: "Generate a docker-compose.yml with Node.js backend, Redis for sessions, PostgreSQL for user data, and include hot-reload volumes."

3. **Core Documentation**
   - API contract definitions (OpenAPI spec)
   - WebRTC flow diagrams
   - Database schema
   
   **AI Prompt**: "Create an OpenAPI 3.0 spec for a real-time audio streaming service with endpoints: /session/create, /session/join, /session/leave. Include WebSocket events for signaling."

---

## 📱 **PHASE 1: MVP - Single P2P Connection (Mobile)**
*Duration: 1 week | AI Context: Proof of Concept*

### 1.1 Backend Signaling Server
**AI Prompt Template**:
```
Create a Node.js Express server with Socket.io that:
- Generates 6-digit session codes
- Handles WebRTC SDP offer/answer exchange
- Manages ICE candidate relay
- Stores active sessions in Redis with 30min TTL
- Exposes REST endpoint POST /api/session/create
- Exposes WebSocket events: 'join', 'offer', 'answer', 'ice-candidate'
```

**Files to Create**:
- `backend/src/server.js`
- `backend/src/routes/session.js`
- `backend/src/sockets/signaling.js`
- `backend/src/utils/codeGenerator.js`

### 1.2 Flutter Audio Capture (Android Only)
**AI Prompt**:
```
Create a Flutter plugin wrapper for Android AudioPlaybackCapture API that:
- Requests RECORD_AUDIO permission
- Captures system audio using MediaProjection
- Streams PCM audio to Opus encoder
- Returns audio chunks as Uint8List
- Include example usage in main.dart
```

**Files to Create**:
- `mobile/android/app/src/main/kotlin/AudioCapturePlugin.kt`
- `mobile/lib/services/audio_capture_service.dart`
- `mobile/lib/utils/opus_encoder.dart`

### 1.3 WebRTC P2P Connection
**AI Prompt**:
```
Implement WebRTC peer connection in Flutter using flutter_webrtc that:
- Host creates RTCPeerConnection with audio-only stream
- Sends SDP offer via Socket.io to backend
- Listener receives offer and sends answer
- Handles ICE candidates automatically
- Includes connection state callbacks (connected, disconnected, failed)
```

**Files to Create**:
- `mobile/lib/services/webrtc_service.dart`
- `mobile/lib/models/peer_connection.dart`

### 1.4 Basic UI (Host + Listener)
**AI Prompt**:
```
Create Flutter screens:
1. Home: Two buttons "Start Party" and "Join Party"
2. Host: Shows 6-digit code, QR code, Start/Stop buttons
3. Listener: Input field for code, Connect button, Connection status
Use Material 3 design with dark theme
```

**Files to Create**:
- `mobile/lib/screens/home_screen.dart`
- `mobile/lib/screens/host_screen.dart`
- `mobile/lib/screens/listener_screen.dart`

---

## 🔄 **PHASE 2: Multi-Listener Support**
*Duration: 5-7 days | AI Context: Scalability*

### 2.1 SFU Media Server Setup
**AI Prompt**:
```
Set up Janus Gateway Docker container with:
- AudioBridge plugin for multi-party audio mixing
- WebSocket/HTTP transport
- Configure STUN/TURN servers (using Coturn)
- Create Node.js adapter service to manage Janus rooms
```

**Files to Create**:
- `backend/docker/janus/Dockerfile`
- `backend/src/services/janus-adapter.js`
- `backend/config/janus.config.js`

### 2.2 Session Management Refactor
**AI Prompt**:
```
Refactor backend to support multiple listeners:
- Host creates room in Janus
- Each listener joins as participant
- Track connected devices with user IDs in Redis
- Emit 'participant-joined' and 'participant-left' events
- Add endpoint GET /api/session/:code/participants
```

### 2.3 Synchronization Logic
**AI Prompt**:
```
Implement NTP-style time sync:
1. Host sends periodic timestamp pings (every 2 seconds)
2. Listeners calculate round-trip time
3. Adjust local playback buffer based on offset
4. Create TimeSync class with drift correction
Include unit tests for offset calculation
```

**Files to Create**:
- `mobile/lib/services/time_sync_service.dart`
- `mobile/test/time_sync_test.dart`

### 2.4 Host Dashboard UI
**AI Prompt**:
```
Create Flutter widget for connected devices list:
- Show device names (auto-generated: "Device 1", "Device 2")
- Display latency in ms with color coding (green <50ms, yellow <100ms, red >100ms)
- Add kick button for each device
- Show total listener count badge
```

---

## 🌐 **PHASE 3: Web Application**
*Duration: 1 week | AI Context: Browser Support*

### 3.1 React Web App Foundation
**AI Prompt**:
```
Create React 18 app with Vite:
- TypeScript + Tailwind CSS
- React Router for /host and /listener routes
- Socket.io-client setup
- WebRTC browser API wrapper
- Responsive design for mobile/desktop
```

**Folder Structure**:
```
web/
├── src/
│   ├── components/ (UI components)
│   ├── services/ (WebRTC, Socket)
│   ├── hooks/ (useWebRTC, useSession)
│   ├── pages/ (Host, Listener)
│   └── utils/ (audio, sync)
```

### 3.2 Web Audio API Integration
**AI Prompt**:
```
Implement browser audio capture and playback:
1. For Host: Use getUserMedia with 'audiooutput' constraint (Chrome only, fallback warning)
2. For Listener: Use Web Audio API AudioContext for low-latency playback
3. Create OpusEncoder using opus-recorder library
4. Handle audio worklets for processing
```

**Files to Create**:
- `web/src/services/webAudioService.ts`
- `web/src/utils/opusEncoder.ts`
- `web/src/workers/audioProcessor.worklet.js`

### 3.3 Cross-Platform Session Interop
**AI Prompt**:
```
Ensure mobile and web clients can connect to same session:
- Use same session code format (6 digits)
- Standardize WebSocket message protocol
- Handle browser WebRTC constraints (no AudioPlaybackCapture)
- Add platform identifier in connection metadata
```

---

## 🎵 **PHASE 4: Audio Source Integration**
*Duration: 1 week | AI Context: Third-Party APIs*

### 4.1 Spotify Integration (Mobile)
**AI Prompt**:
```
Integrate Spotify SDK for Android/iOS:
1. Implement Spotify OAuth 2.0 flow
2. Use Spotify playback SDK to play tracks
3. Capture audio output (Android: AudioPlaybackCapture, iOS: screen recording workaround)
4. Show "Now Playing" metadata (track, artist, album art)
```

**Files**:
- `mobile/lib/services/spotify_service.dart`
- `mobile/lib/models/track_metadata.dart`

### 4.2 YouTube Playback (WebView Approach)
**AI Prompt**:
```
Create YouTube player integration:
1. Embed YouTube iframe player in WebView
2. Use youtube_player_flutter package
3. Inject JavaScript to sync playback state
4. Capture audio via system audio (not from WebView directly)
Note: Explain limitations due to YouTube TOS
```

### 4.3 Local File Player
**AI Prompt**:
```
Implement local audio file player:
- File picker for MP3/FLAC/WAV/M4A
- Use audioplayers package
- Extract metadata (title, artist) using flutter_audio_metadata
- Stream file audio through WebRTC pipeline
```

---

## 🔧 **PHASE 5: Production Hardening**
*Duration: 1-2 weeks | AI Context: Reliability*

### 5.1 Error Handling & Reconnection
**AI Prompt**:
```
Implement robust error handling:
1. WebRTC connection failure → retry 3 times with exponential backoff
2. Network loss → buffer audio and resync when reconnected
3. Host disconnect → notify all listeners and end session gracefully
4. Add Sentry error tracking
Create error recovery flow diagram
```

### 5.2 Adaptive Bitrate
**AI Prompt**:
```
Implement dynamic quality adjustment:
- Monitor RTT (round-trip time) and packet loss
- Adjust Opus bitrate between 64-128kbps
- Switch to lower sample rate (24kHz) if connection poor
- Show quality indicator in UI (HD/SD/LD)
```

### 5.3 Battery Optimization
**AI Prompt**:
```
Optimize Flutter app for battery life:
1. Use WorkManager for background audio capture (Android)
2. Implement audio silence detection to pause streaming
3. Reduce wake locks
4. Profile with Flutter DevTools
Provide before/after battery drain metrics
```

### 5.4 Testing Suite
**AI Prompt**:
```
Create comprehensive tests:
1. Unit tests: Time sync calculations, session code generation
2. Integration tests: WebRTC connection flow, multi-device sync
3. E2E tests: Full host-listener flow using Flutter integration tests
4. Load test: Simulate 10 concurrent listeners with k6
```

---

## 🚀 **PHASE 6: Deployment & Monitoring**
*Duration: 3-5 days | AI Context: DevOps*

### 6.1 Backend Deployment
**AI Prompt**:
```
Create AWS infrastructure using Terraform:
- ECS cluster for Node.js backend
- ElastiCache for Redis
- RDS PostgreSQL instance
- Application Load Balancer with WebSocket support
- CloudWatch logging and alarms
- Auto-scaling policies for >100 concurrent sessions
```

### 6.2 Mobile App Release
**AI Prompt**:
```
Set up CI/CD pipeline with GitHub Actions:
1. Android: Build signed APK/AAB, deploy to Google Play Internal Testing
2. iOS: Build IPA with fastlane, upload to TestFlight
3. Run automated tests before build
4. Generate release notes from git commits
```

### 6.3 Web Deployment
**AI Prompt**:
```
Deploy React app to Vercel/Netlify:
- Configure environment variables for backend URLs
- Set up CDN for static assets
- Enable Brotli compression
- Add service worker for offline capability
```

### 6.4 Monitoring Dashboard
**AI Prompt**:
```
Create Grafana dashboard showing:
- Active sessions count
- Average latency per session
- WebRTC connection success rate
- Audio quality distribution
- Server CPU/memory usage
Use Prometheus for metrics collection
```

---

## 🎨 **PHASE 7: Polish & Advanced Features**
*Duration: Ongoing*

### 7.1 UI/UX Refinement
- Animated connection flows
- Haptic feedback
- Dark/light theme toggle
- Onboarding tutorial

### 7.2 Advanced Features
- Polls for next track voting
- Chat within session
- Session recording (with consent)
- Chromecast support

---

## 📝 **AI Collaboration Best Practices**

### For Each Task:
1. **Start with Context**: 
   ```
   "I'm building a real-time audio streaming app called 'sync'. 
   Current architecture: [brief summary]. 
   This task involves: [specific goal]."
   ```

2. **Request Structured Output**:
   - "Include comments explaining WebRTC logic"
   - "Add error handling for network failures"
   - "Generate TypeScript interfaces first"

3. **Iterate Incrementally**:
   - Build one feature at a time
   - Test before moving forward
   - Ask AI to review previous code before adding features

4. **Use AI for Debugging**:
   ```
   "This WebRTC connection keeps failing with error [X]. 
   Here's my code: [paste]. 
   What's wrong and how to fix?"
   ```

---

## 🎯 **Critical Path Summary**

```
Week 1-2:  Phase 0 + Phase 1 (MVP P2P)
Week 3:    Phase 2 (Multi-listener)
Week 4:    Phase 3 (Web App)
Week 5:    Phase 4 (Integrations)
Week 6-7:  Phase 5 (Hardening)
Week 8:    Phase 6 (Deployment)
Ongoing:   Phase 7 (Polish)
```

---

## 💡 **Pro Tips for AI Coding Assistants**

1. **Always specify versions**: "Use flutter_webrtc ^0.9.48"
2. **Request architecture first**: "Design the class structure before implementation"
3. **Ask for alternatives**: "Show me 2 approaches for time synchronization"
4. **Demand testing**: "Include unit tests for this function"
5. **Optimize prompts**: Reference previous context with "Building on the WebRTC service we created earlier..."
