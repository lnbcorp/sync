# 🎯 How to Instruct Windsurf/Cursor for Specific Tasks

## 📋 **General Instruction Framework**

### **The Perfect Prompt Structure:**
```
[CONTEXT] + [SPECIFIC TASK] + [CONSTRAINTS] + [EXPECTED OUTPUT]
```

---

## 🔧 **Method 1: Using Cursor Composer (Recommended)**

### Step-by-Step:

1. **Open Composer** (Cmd+I on Mac, Ctrl+I on Windows)

2. **Use This Template:**
```
CONTEXT:
I'm building "sync" - a real-time audio streaming app.
Current stack: Flutter (mobile), React (web), Node.js (backend).
We're at Phase 1: Building the signaling server.

TASK:
Create a Node.js Express server with Socket.io for WebRTC signaling.

REQUIREMENTS:
- Generate 6-digit session codes (stored in Redis with 30min TTL)
- Handle WebSocket events: 'create-session', 'join-session', 'offer', 'answer', 'ice-candidate'
- REST endpoint: POST /api/session/create (returns session code)
- REST endpoint: GET /api/session/:code (returns session status)
- Use TypeScript
- Include error handling for invalid codes
- Add logging with Winston

FILE STRUCTURE:
backend/
├── src/
│   ├── server.ts (main entry point)
│   ├── routes/sessionRoutes.ts
│   ├── sockets/signalingHandler.ts
│   ├── utils/codeGenerator.ts
│   └── config/redis.ts

OUTPUT:
Generate all files listed above with complete implementation.
Include package.json with dependencies.
Add comments explaining WebRTC flow.
```

3. **Tag Relevant Files** (if they exist):
   - Click the `@` button in Composer
   - Select files like `package.json`, existing config files
   - This gives AI context about your project

---

## 🎨 **Method 2: Using Windsurf Cascade (Advanced)**

### **Cascade Chat Commands:**

```bash
# Start a new cascade session
/cascade create backend-signaling

# Give context
@workspace I'm building a WebRTC signaling server.
Reference the PRD at @prd-1.md

# Specific instruction
Create the following files:
1. src/server.ts - Express + Socket.io setup
2. src/routes/sessionRoutes.ts - REST API for sessions
3. src/sockets/signalingHandler.ts - WebSocket handlers

Use these requirements:
- TypeScript with strict mode
- Redis for session storage (use ioredis)
- Generate 6-digit alphanumeric codes
- WebRTC SDP exchange via Socket.io
- Include unit tests using Jest

# Ask for file-by-file generation
Start with server.ts first, then wait for my approval before continuing.
```

---

## 💻 **Method 3: Inline Chat (Quick Edits)**

### **For Small Changes:**

1. **Highlight code** in your editor
2. **Press Cmd+K (Mac) or Ctrl+K (Windows)**
3. **Give instruction:**

```
Add error handling to this function:
- Catch Redis connection errors
- Return 500 status with error message
- Log error to console with timestamp
```

---

## 📁 **Method 4: Multi-File Editing with Context**

### **Example: Creating Flutter Audio Capture Service**

```
CONTEXT:
@prd-1.md shows we need Android audio capture using AudioPlaybackCapture API.
Current project structure: @mobile/lib/

TASK:
Create a Flutter plugin for Android audio capture.

FILES TO CREATE:
1. mobile/android/app/src/main/kotlin/com/sync/AudioCapturePlugin.kt
2. mobile/lib/services/audio_capture_service.dart
3. mobile/lib/models/audio_chunk.dart

ANDROID PLUGIN (AudioCapturePlugin.kt):
- Implement MethodChannel for Flutter communication
- Use MediaProjection API to capture system audio
- Request RECORD_AUDIO permission
- Stream PCM audio as byte arrays to Flutter
- Methods: startCapture(), stopCapture(), requestPermission()

FLUTTER SERVICE (audio_capture_service.dart):
- Create singleton class AudioCaptureService
- MethodChannel to communicate with Kotlin plugin
- Stream<Uint8List> get audioStream
- Future<bool> requestPermission()
- Future<void> startCapture()
- Future<void> stopCapture()

MODEL (audio_chunk.dart):
- Class AudioChunk with:
  - Uint8List data
  - int timestamp
  - int sampleRate (default 48000)
  
CONSTRAINTS:
- Use Dart 3.0+ syntax
- Include null safety
- Add error handling for permission denial
- Add comments explaining Android-specific APIs

OUTPUT FORMAT:
Generate complete files one by one.
After each file, wait for my confirmation before proceeding.
```

---

## 🔥 **Pro Tips for Better AI Responses**

### **1. Reference Existing Files:**
```
Looking at @backend/src/server.ts, add a new route for...
```

### **2. Specify Code Style:**
```
Use functional components (not classes).
Follow Airbnb style guide.
Use async/await (not .then()).
```

### **3. Request Incremental Steps:**
```
First, show me the interface definitions.
Then, implement the main class.
Finally, add error handling.
```

### **4. Ask for Explanations:**
```
Generate the code AND explain:
- Why you chose this approach
- What each major section does
- Potential edge cases to watch for
```

### **5. Provide Examples:**
```
Similar to how we implemented @services/webrtc_service.dart,
create a time sync service that...
```

---

## 🎯 **Phase-Specific Prompt Templates**

### **PHASE 0: Repository Setup**

```
TASK: Initialize monorepo for sync app

Create the following structure:
sync-app/
├── mobile/ (Flutter)
├── web/ (React + Vite)
├── backend/ (Node.js + Express)
├── shared/ (TypeScript types)
└── docker-compose.yml

FOR MOBILE:
- Run: flutter create mobile
- Add dependencies: flutter_webrtc, socket_io_client, provider
- Create folder structure: lib/services, lib/screens, lib/models

FOR WEB:
- Run: npm create vite@latest web -- --template react-ts
- Add dependencies: socket.io-client, tailwindcss
- Setup: src/components, src/services, src/hooks

FOR BACKEND:
- Initialize npm with TypeScript
- Dependencies: express, socket.io, ioredis, pg, dotenv, winston
- Structure: src/routes, src/sockets, src/services, src/config

FOR DOCKER:
- Services: backend (Node), redis, postgres
- Include volumes for hot reload
- Environment variables for database credentials

Generate:
1. All package.json files
2. tsconfig.json for backend and web
3. docker-compose.yml
4. .gitignore files
5. README.md with setup instructions

Do NOT run commands automatically - just generate the files.
```

---

### **PHASE 1: Backend Signaling Server**

```
CONTEXT:
@docker-compose.yml shows Redis on port 6379, Postgres on 5432.
@backend/package.json has express, socket.io, ioredis installed.

TASK: Implement WebRTC signaling server

CREATE FILE: backend/src/utils/codeGenerator.ts
- Function generateSessionCode(): string
- Returns 6-digit alphanumeric (uppercase)
- Example: "A7K2M9"
- Use crypto.randomBytes for randomness

CREATE FILE: backend/src/config/redis.ts
- Export Redis client using ioredis
- Connection: localhost:6379
- Include reconnect logic
- Export helper functions:
  - setSession(code, hostId, ttl=1800)
  - getSession(code)
  - deleteSession(code)

CREATE FILE: backend/src/routes/sessionRoutes.ts
- POST /api/session/create
  - Generates code
  - Stores in Redis: {code: {hostId, createdAt, participants: []}}
  - Returns: {code, expiresIn}
- GET /api/session/:code
  - Returns session data or 404

CREATE FILE: backend/src/sockets/signalingHandler.ts
- Socket.io event handlers:
  - 'join-session': {code, userId}
    - Validate code exists in Redis
    - Add participant to session
    - Emit 'participant-joined' to host
  - 'offer': {code, sdp}
    - Relay to all participants except sender
  - 'answer': {code, sdp, targetId}
    - Relay to specific peer
  - 'ice-candidate': {code, candidate, targetId}
    - Relay ICE candidate

CREATE FILE: backend/src/server.ts
- Initialize Express app
- Setup Socket.io with CORS
- Mount routes: app.use('/api/session', sessionRoutes)
- Attach signaling handlers
- Listen on port 3000

REQUIREMENTS:
- Use TypeScript strict mode
- Add Winston logging for all events
- Include try-catch blocks
- Emit errors back to clients: socket.emit('error', {message})

OUTPUT:
Generate all 5 files with complete implementation.
Show me server.ts first for review.
```

---

### **PHASE 2: Flutter Audio Capture (Android)**

```
CONTEXT:
Flutter project at @mobile/
Android SDK min version: 21, target: 34
We need to capture system audio using AudioPlaybackCapture API

TASK: Create Android audio capture plugin

FILE 1: mobile/android/app/src/main/kotlin/com/sync/app/AudioCapturePlugin.kt

Requirements:
- Extend FlutterPlugin and MethodCallHandler
- Channel name: "com.sync.app/audio_capture"
- Methods:
  1. "requestPermission" → Request RECORD_AUDIO via ActivityCompat
  2. "startCapture" → Start MediaProjection + AudioPlaybackCapture
  3. "stopCapture" → Stop recording and release resources
  
Audio Capture Setup:
- Use AudioPlaybackCaptureConfiguration.Builder
- AudioFormat: ENCODING_PCM_16BIT, 48000Hz, CHANNEL_IN_STEREO
- Buffer size: AudioRecord.getMinBufferSize()
- Read audio in background thread
- Send chunks via EventChannel ("com.sync.app/audio_stream")

Error Handling:
- Permission denied → sendError("PERMISSION_DENIED")
- Capture failed → sendError("CAPTURE_FAILED")

FILE 2: mobile/lib/services/audio_capture_service.dart

Create class AudioCaptureService:
- static const platform = MethodChannel('com.sync.app/audio_capture')
- static const stream = EventChannel('com.sync.app/audio_stream')
- Stream<Uint8List>? _audioStream

Methods:
- Future<bool> requestPermission()
- Future<void> startCapture()
- Future<void> stopCapture()
- Stream<Uint8List> get audioStream (lazy init from EventChannel)

FILE 3: mobile/android/app/src/main/AndroidManifest.xml
Add permissions:
- RECORD_AUDIO
- FOREGROUND_SERVICE
- FOREGROUND_SERVICE_MEDIA_PROJECTION (API 34+)

GENERATE:
1. AudioCapturePlugin.kt with full implementation
2. audio_capture_service.dart
3. Updated AndroidManifest.xml snippet
4. Example usage in comments

EXPLAIN:
- Why we need MediaProjection for system audio
- Difference between RECORD_AUDIO (mic) and AudioPlaybackCapture (system)
```

---

### **PHASE 3: WebRTC Connection (Flutter)**

```
CONTEXT:
@mobile/pubspec.yaml has flutter_webrtc: ^0.9.48
@mobile/lib/services/audio_capture_service.dart provides audio stream
Backend signaling server at ws://localhost:3000

TASK: Implement WebRTC peer connection service

FILE: mobile/lib/services/webrtc_service.dart

Create class WebRTCService:

PROPERTIES:
- RTCPeerConnection? _peerConnection
- SocketIO socket (from socket_io_client)
- String? sessionCode
- MediaStream? _localStream
- List<RTCIceCandidate> _iceCandidates = []

METHODS:

1. Future<void> initializeAsHost(String code)
   - Connect socket to backend
   - Create RTCPeerConnection with config:
     - iceServers: [{urls: "stun:stun.l.google.com:19302"}]
   - Get audio stream from AudioCaptureService
   - Add audio track to peer connection
   - Listen for ICE candidates → send via socket
   - Create offer → send to signaling server
   
2. Future<void> initializeAsListener(String code)
   - Connect socket to backend
   - Emit 'join-session' with code
   - Listen for 'offer' event
   - Create RTCPeerConnection
   - Set remote description from offer
   - Create answer → send to signaling server
   
3. void _handleIceCandidate(RTCIceCandidate candidate)
   - Send to backend via socket.emit('ice-candidate', {...})
   
4. Future<void> addIceCandidate(RTCIceCandidate candidate)
   - Add to _peerConnection
   
5. void dispose()
   - Close peer connection
   - Disconnect socket
   - Stop audio streams

SOCKET EVENTS:
- Listen: 'offer', 'answer', 'ice-candidate', 'participant-joined'
- Emit: 'offer', 'answer', 'ice-candidate', 'join-session'

ERROR HANDLING:
- Wrap WebRTC calls in try-catch
- Log errors with stack traces
- Emit errors to UI via Stream<String> errorStream

INCLUDE:
- Comments explaining each WebRTC step
- Connection state callbacks (connected, failed, disconnected)
- Example usage in comments

CONSTRAINTS:
- Use async/await (not .then)
- Null safety
- Dispose pattern for cleanup
```

---

## 🚀 **Advanced Cursor/Windsurf Features**

### **1. Agent Mode (Windsurf)**
```
Enable @agent mode for complex multi-step tasks:

@agent 
Task: Implement complete audio synchronization system

Steps:
1. Create time_sync_service.dart with NTP-style sync
2. Integrate with webrtc_service.dart
3. Add latency display in host_screen.dart
4. Write unit tests for sync logic

Work autonomously but ask for confirmation before:
- Modifying existing critical files
- Installing new dependencies
- Changing API contracts

Show me diffs before applying changes.
```

### **2. Codebase Context (Cursor)**
```
@codebase 

Question: How should I integrate Opus encoding with the existing AudioCaptureService?

Look at:
- Current audio pipeline
- Dependencies in pubspec.yaml
- Similar encoding patterns in the codebase
```

### **3. Terminal Commands**
```
# In Cursor/Windsurf terminal:

Run these commands in sequence:
cd backend
npm install express socket.io ioredis
npm install -D @types/express typescript

Show me the updated package.json after completion.
```

---

## 📊 **Comparison: When to Use What**

| Task Type | Use This Method | Example |
|-----------|----------------|---------|
| Create new files | Composer | "Create backend server.ts" |
| Modify existing code | Inline Chat (Cmd+K) | "Add error handling here" |
| Multi-file refactor | Agent Mode | "Refactor all services to use dependency injection" |
| Quick questions | Normal Chat | "Explain WebRTC signaling flow" |
| Architecture decisions | Composer with @codebase | "Should I use Redux or Context API?" |
| Debug specific code | Highlight + Cmd+K | "Why is this WebRTC connection failing?" |

---

## 🎯 **Real Example: Complete Phase 1 Task**

### **Exact Steps in Cursor:**

1. **Open Composer (Cmd+I)**

2. **Paste This:**
```
I'm at Phase 1 of building the "sync" app (see @prd-1.md).

Create the complete backend signaling server with these exact specifications:

ARCHITECTURE:
- Node.js + Express + Socket.io + TypeScript
- Redis for session storage (via ioredis)
- Port 3000

FILES TO GENERATE:
1. backend/src/server.ts
2. backend/src/routes/sessionRoutes.ts  
3. backend/src/sockets/signalingHandler.ts
4. backend/src/utils/codeGenerator.ts
5. backend/src/config/redis.ts
6. backend/package.json
7. backend/tsconfig.json

DETAILED REQUIREMENTS:

codeGenerator.ts:
- Export function: generateSessionCode(): string
- Returns 6-character alphanumeric (A-Z, 0-9)
- Use crypto.randomBytes(4)

redis.ts:
- Redis client with host: localhost, port: 6379
- Functions: setSession(code, data, ttl), getSession(code), deleteSession(code)
- Auto-reconnect on disconnect

sessionRoutes.ts:
- POST /create → generates code, stores in Redis, returns {code, expiresIn: 1800}
- GET /:code → returns session data or 404

signalingHandler.ts:
- 'join-session': validate code, add participant, emit 'participant-joined'
- 'offer': relay SDP to target peer
- 'answer': relay SDP to target peer  
- 'ice-candidate': relay ICE candidate to target peer

server.ts:
- Initialize Express
- Setup Socket.io with CORS (allow localhost:*)
- Mount session routes at /api/session
- Attach signaling handlers
- app.listen(3000)

CODE STYLE:
- TypeScript strict mode
- Async/await syntax
- Try-catch error handling
- Winston logging for events

START WITH:
Generate server.ts first. Wait for my review before creating other files.
```

3. **Review server.ts**

4. **If good, continue:**
```
Approved. Generate the remaining 6 files following the same pattern.
```

5. **Test:**
```
Create a simple test file that:
- Sends POST /api/session/create
- Connects WebSocket
- Emits 'join-session' event
- Verifies response

Use curl for REST API and socket.io-client for WebSocket
```

---

## ✅ **Checklist Before Asking AI**

- [ ] Defined clear context (what already exists)
- [ ] Specified exact task (not vague "make it work")
- [ ] Listed all files to create/modify
- [ ] Included technical constraints (libraries, versions)
- [ ] Requested specific output format
- [ ] Added error handling requirements
- [ ] Asked for explanations if needed

---

This approach will give you **clean, production-ready code** that fits perfectly into your sync app architecture! 🚀
