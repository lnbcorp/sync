import { io } from 'socket.io-client';

class SyncApp {
  private socket: any = null;
  private sessionCode: string | null = null;
  private isHost: boolean = false;
  private peerIdToPeerConnection: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private audioStream: MediaStream | null = null;
  private isSharingAudio: boolean = false;

  constructor() {
    this.initializeEventListeners();
    this.startKeepAlive();
  }

  private initializeEventListeners() {
    const createBtn = document.getElementById('create-session-btn') as HTMLButtonElement;
    const joinBtn = document.getElementById('join-session-btn') as HTMLButtonElement;
    const leaveBtn = document.getElementById('leave-session-btn') as HTMLButtonElement;
    const joinCodeInput = document.getElementById('join-code') as HTMLInputElement;
    const startAudioBtn = document.getElementById('start-audio-btn') as HTMLButtonElement;
    const stopAudioBtn = document.getElementById('stop-audio-btn') as HTMLButtonElement;
    const startCamBtn = document.getElementById('start-camera-btn') as HTMLButtonElement;
    const stopCamBtn = document.getElementById('stop-camera-btn') as HTMLButtonElement;
    const shareScreenBtn = document.getElementById('share-screen-btn') as HTMLButtonElement;
    const stopShareBtn = document.getElementById('stop-share-btn') as HTMLButtonElement;

    createBtn?.addEventListener('click', () => this.createSession());
    joinBtn?.addEventListener('click', () => this.joinSession());
    leaveBtn?.addEventListener('click', () => this.leaveSession());
    
    joinCodeInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinSession();
      }
    });

    startAudioBtn?.addEventListener('click', () => this.startAudioSharing());
    stopAudioBtn?.addEventListener('click', () => this.stopAudioSharing());
    startCamBtn?.addEventListener('click', () => this.startCamera());
    stopCamBtn?.addEventListener('click', () => this.stopCamera());
    shareScreenBtn?.addEventListener('click', () => this.startScreenShare());
    stopShareBtn?.addEventListener('click', () => this.stopScreenShare());
  }

  private async createSession() {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 
        (import.meta.env.DEV ? 'http://localhost:3000' : 'https://your-backend-url.onrender.com');
      
      console.log('🔗 Creating session with backend URL:', backendUrl);
      console.log('📡 Making request to:', `${backendUrl}/api/session/create`);
      
      const response = await fetch(`${backendUrl}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Session created successfully:', data);
      
      this.sessionCode = data.code;
      this.isHost = true;

      this.showSessionCode(data.code);
      this.connectToSocket();
      this.updateUI('host');
    } catch (error) {
      this.showError('Failed to create session. Please try again.');
      console.error('Create session error:', error);
    }
  }

  private async joinSession() {
    const joinCodeInput = document.getElementById('join-code') as HTMLInputElement;
    const code = joinCodeInput?.value?.trim().toUpperCase();

    if (!code || code.length !== 6) {
      this.showError('Please enter a valid 6-character session code.');
      return;
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 
        (import.meta.env.DEV ? 'http://localhost:3000' : 'https://your-backend-url.onrender.com');
      
      const response = await fetch(`${backendUrl}/api/session/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join session');
      }

      this.sessionCode = code;
      this.isHost = false;
      this.connectToSocket();
      this.updateUI('listener');
    } catch (error) {
      this.showError(`Failed to join session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Join session error:', error);
    }
  }

  private connectToSocket() {
    if (!this.sessionCode) {
      console.log('⚠️ No session code, skipping socket connection');
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://your-backend-url.railway.app');

    console.log('🔌 Connecting to socket with URL:', backendUrl);
    console.log('📝 Session code:', this.sessionCode);

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      console.log('📤 Emitting join with code:', this.sessionCode);
      this.socket.emit('join', { code: this.sessionCode });
    });

    this.socket.on('participant-joined', (data: any) => {
      console.log('Participant joined:', data.id);
      this.showStatus(`Participant joined (${data.id})`);
      // Pre-create PC so tracks are ready
      this.ensurePeerConnectionFor(data.id).catch(() => {});
    });

    this.socket.on('participant-left', (data: any) => {
      console.log('Participant left:', data.id);
      this.showStatus(`Participant left (${data.id})`);
      const pc = this.peerIdToPeerConnection.get(data.id);
      if (pc) {
        try { pc.getSenders().forEach(s => s.track && s.track.stop()); } catch {}
        try { pc.close(); } catch {}
        this.peerIdToPeerConnection.delete(data.id);
        this.logToUI(`🔻 Closed and removed PC for ${data.id}`);
      }
    });

    this.socket.on('room-size', (data: any) => {
      console.log('Room size:', data.size);
      this.showStatus(`Connected participants: ${data.size}`);
    });

    this.socket.on('error', (data: any) => {
      console.error('❌ Socket error:', data);
      this.showError(data.message);
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('🔌 Disconnected from server. Reason:', reason);
      this.showError('Connection lost. Please try again.');
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('❌ Socket connection error:', error);
      this.showError(`Connection failed: ${error.message}`);
    });

    // Signaling: server requests existing peers to offer to a newcomer
    this.socket.on('request-offer', async ({ to, code }: any) => {
      try {
        this.logToUI(`📨 Server requesting offer to ${to}`);
        if (!this.sessionCode) return;
        const pc = await this.ensurePeerConnectionFor(to);
        this.logToUI('📝 Creating offer...');
        const rawOffer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        const tunedOffer = { type: rawOffer.type, sdp: this.tuneOpusInSdp(rawOffer.sdp || '') } as RTCSessionDescriptionInit;
        await pc.setLocalDescription(tunedOffer);
        this.socket.emit('offer', { code: code || this.sessionCode, sdp: tunedOffer, to });
        this.logToUI(`📤 Sent offer to ${to}`);
        console.log('📨 Sent offer to', to);
      } catch (err) {
        this.logToUI(`❌ Failed to create/send offer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to create/send offer:', err);
      }
    });

    // Signaling: receive offer
    this.socket.on('offer', async ({ from, sdp, code }: any) => {
      try {
        this.logToUI(`📨 Received offer from ${from}`);
        const pc = await this.ensurePeerConnectionFor(from);
        this.logToUI('📝 Setting remote description...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.logToUI('📝 Creating answer...');
        let answer = await pc.createAnswer();
        answer = { type: answer.type, sdp: this.tuneOpusInSdp(answer.sdp || '') } as RTCSessionDescriptionInit;
        await pc.setLocalDescription(answer);
        this.socket.emit('answer', { code: code || this.sessionCode, sdp: answer, to: from });
        this.logToUI(`📤 Sent answer to ${from}`);
        console.log('📨 Sent answer to', from);
      } catch (err) {
        this.logToUI(`❌ Failed to handle offer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to handle offer:', err);
      }
    });

    // Signaling: receive answer
    this.socket.on('answer', async ({ from, sdp }: any) => {
      try {
        this.logToUI('📨 Received answer');
        const pc = from ? this.peerIdToPeerConnection.get(from) : null;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this.logToUI('✅ Remote description set from answer');
        console.log('✅ Remote description set from answer');
      } catch (err) {
        this.logToUI(`❌ Failed to handle answer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to handle answer:', err);
      }
    });

    // Signaling: receive ICE candidate
    this.socket.on('ice-candidate', async ({ from, candidate }: any) => {
      try {
        this.logToUI(`🧊 Received ICE candidate from ${from}: ${candidate.candidate.substring(0, 50)}...`);
        const pc = from ? this.peerIdToPeerConnection.get(from) : null;
        if (!pc || !candidate) return;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        this.logToUI('✅ ICE candidate added');
      } catch (err) {
        this.logToUI(`❌ Failed to add ICE candidate: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to add ICE candidate:', err);
      }
    });
  }

  private async leaveSession() {
    if (this.sessionCode) {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 
          (import.meta.env.DEV ? 'http://localhost:3000' : 'https://sync-up-nsnr.onrender.com');
        
        await fetch(`${backendUrl}/api/session/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: this.sessionCode }),
        });
      } catch (error) {
        console.error('Leave session error:', error);
      }
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.sessionCode = null;
    this.isHost = false;
    this.updateUI('initial');
  }

  private showSessionCode(code: string) {
    const codeDisplay = document.getElementById('session-code');
    if (codeDisplay) {
      codeDisplay.textContent = code;
      codeDisplay.classList.remove('hidden');
    }
  }

  private showStatus(message: string) {
    const statusId = this.isHost ? 'host-status' : 'join-status';
    const status = document.getElementById(statusId);
    if (status) {
      status.textContent = message;
      status.className = 'status success';
      status.classList.remove('hidden');
    }
  }

  private showError(message: string) {
    const statusId = this.isHost ? 'host-status' : 'join-status';
    const status = document.getElementById(statusId);
    if (status) {
      status.textContent = message;
      status.className = 'status error';
      status.classList.remove('hidden');
    }
  }

  private async ensurePeerConnectionFor(peerId: string): Promise<RTCPeerConnection> {
    const existing = this.peerIdToPeerConnection.get(peerId);
    if (existing) return existing;

    this.logToUI(`🔧 Creating new peer connection for ${peerId}...`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
          'stun:stun.stunprotocol.org:3478'
        ] }
      ]
    });
    this.logToUI('🧊 ICE servers configured: Google STUN + stunprotocol');
    this.peerIdToPeerConnection.set(peerId, pc);
    this.logToUI(`✅ Peer connection created for ${peerId}`);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.sessionCode) {
        this.logToUI(`🧊 ICE candidate for ${peerId}: ${event.candidate.candidate.substring(0, 50)}...`);
        this.socket?.emit('ice-candidate', { code: this.sessionCode, candidate: event.candidate, to: peerId });
      } else if (event.candidate) {
        this.logToUI(`🧊 ICE candidate generated (no session code) for ${peerId}`);
      } else {
        this.logToUI(`🧊 ICE gathering complete for ${peerId}`);
      }
    };

    pc.ontrack = (event) => {
      this.logToUI(`📺 Remote track received from ${peerId}: ${event.track.kind}`);
      if (event.track.kind === 'audio') {
        const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement | null;
        const enableBtn = document.getElementById('enable-audio-btn') as HTMLButtonElement | null;
        if (remoteAudio) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.muted = false;
          remoteAudio.play().catch(() => {
            this.logToUI('🔇 Autoplay blocked. Showing Enable Audio button.');
            if (enableBtn) {
              enableBtn.style.display = 'inline-block';
              enableBtn.onclick = () => {
                remoteAudio.play().then(() => {
                  enableBtn.style.display = 'none';
                  this.logToUI('🔊 Audio playback enabled by user.');
                }).catch((err) => this.logToUI(`❌ Audio play failed: ${err}`));
              };
            }
          });
          try {
            pc.getReceivers().forEach((r) => {
              if (r.track && r.track.kind === 'audio' && 'playoutDelayHint' in r) {
                // @ts-ignore
                r.playoutDelayHint = 0.02;
                this.logToUI('⏱️ Set playoutDelayHint=0.02s on audio receiver');
              }
            });
          } catch {}
          this.logToUI('✅ Remote audio stream attached');
        }
      } else {
        const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement | null;
        if (remoteVideo) {
          remoteVideo.srcObject = event.streams[0];
          this.logToUI('✅ Remote video stream attached');
        }
      }
    };

    pc.onconnectionstatechange = () => {
      this.logToUI(`🔗 Connection state (${peerId}): ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      this.logToUI(`🧊 ICE connection state (${peerId}): ${pc.iceConnectionState}`);
    };

    // Add existing local tracks to this new PC
    const addTracks = () => {
      const audioTracks = this.audioStream?.getAudioTracks() || [];
      const videoTracks: MediaStreamTrack[] = [];
      if (this.localStream) videoTracks.push(...this.localStream.getVideoTracks());
      if (this.screenTrack) videoTracks.push(this.screenTrack);
      [...audioTracks, ...videoTracks].forEach((t) => pc.addTrack(t, new MediaStream([t])));
    };
    addTracks();

    return pc;
  }

  private async startCamera() {
    try {
      if (this.localStream) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.localStream = stream;
      const localVideo = document.getElementById('local-video') as HTMLVideoElement | null;
      if (localVideo) localVideo.srcObject = stream;

      // Add camera tracks to all peers
      this.peerIdToPeerConnection.forEach((pc, peerId) => {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.createOffer().then((raw) => {
          const tuned = { type: raw.type, sdp: this.tuneOpusInSdp(raw.sdp || '') } as RTCSessionDescriptionInit;
          pc.setLocalDescription(tuned).then(() => {
            this.socket?.emit('offer', { code: this.sessionCode, sdp: tuned, to: peerId });
            this.logToUI(`📤 Sent renegotiation offer (camera) to ${peerId}`);
          });
        });
      });

      // Enable related controls
      (document.getElementById('stop-camera-btn') as HTMLButtonElement)?.removeAttribute('disabled');
    } catch (err) {
      console.error('Failed to start camera:', err);
      this.showError('Could not access camera');
    }
  }

  private stopCamera() {
    if (!this.localStream) return;
    this.localStream.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    const localVideo = document.getElementById('local-video') as HTMLVideoElement | null;
    if (localVideo) localVideo.srcObject = null;
    (document.getElementById('stop-camera-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
  }

  private async startScreenShare() {
    try {
      if (this.screenTrack) return;
      // @ts-ignore Edge/Chrome
      const displayStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      const track = displayStream.getVideoTracks()[0];
      this.screenTrack = track;

      // Replace/add screen video track across peers and renegotiate
      this.replaceOrAddVideoTrack(track);
      this.peerIdToPeerConnection.forEach((pc, peerId) => {
        pc.createOffer().then((raw) => {
          const tuned = { type: raw.type, sdp: this.tuneOpusInSdp(raw.sdp || '') } as RTCSessionDescriptionInit;
          pc.setLocalDescription(tuned).then(() => {
            this.socket?.emit('offer', { code: this.sessionCode, sdp: tuned, to: peerId });
            this.logToUI(`📤 Sent renegotiation offer (screen) to ${peerId}`);
          });
        });
      });

      track.onended = () => {
        this.stopScreenShare();
      };

      (document.getElementById('stop-share-btn') as HTMLButtonElement)?.removeAttribute('disabled');
      console.log('🖥️ Screen sharing started');
    } catch (err) {
      console.error('Failed to start screen share:', err);
      this.showError('Could not start screen share');
    }
  }

  private stopScreenShare() {
    if (!this.screenTrack) return;
    this.screenTrack.stop();
    this.screenTrack = null;
    // If camera is on, switch back to camera video track
    if (this.localStream) {
      const camTrack = this.localStream.getVideoTracks()[0];
      if (camTrack) this.replaceOrAddVideoTrack(camTrack);
    }
    (document.getElementById('stop-share-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
    console.log('🖥️ Screen sharing stopped');
  }

  // Helper: replace existing video track in sender if any, otherwise add
  private replaceOrAddVideoTrack(track: MediaStreamTrack) {
    let sender: RTCRtpSender | null = null;
    this.peerIdToPeerConnection.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(track);
        sender = videoSender;
      } else {
        const dummyStream = new MediaStream([track]);
        pc.addTrack(track, dummyStream);
      }
    });
    return sender;
  }

  private async startAudioSharing() {
    try {
      if (this.isSharingAudio) return;
      
      if (!this.isSystemAudioSupported()) {
        const msg = 'System audio capture is not supported in this browser. Use Chrome on desktop and select "Share tab audio".';
        this.logToUI(`❌ ${msg}`);
        this.showError(msg);
        return;
      }

      this.logToUI('🎵 Starting system audio sharing...');
      this.logToUI('📺 Requesting screen sharing for audio capture...');
      
      // Some browsers (Chrome) require a video track to enable "Share tab audio"
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { width: 1, height: 1, frameRate: 1, cursor: 'never' as any }, 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } as MediaTrackConstraints
      } as DisplayMediaStreamConstraints);
      
      this.logToUI('✅ System audio access granted');
      this.audioStream = stream;
      this.isSharingAudio = true;
      
      this.logToUI('🔌 Setting up peer connection...');
      // Add audio track to all peer connections (existing)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        this.logToUI(`📡 Adding system audio track to all peers: ${audioTrack.label}`);
        this.peerIdToPeerConnection.forEach((pc, peerId) => {
          pc.addTrack(audioTrack, new MediaStream([audioTrack]));
          // renegotiate per peer
          pc.createOffer().then((raw) => {
            const tuned = { type: raw.type, sdp: this.tuneOpusInSdp(raw.sdp || '') } as RTCSessionDescriptionInit;
            pc.setLocalDescription(tuned).then(() => {
              this.socket?.emit('offer', { code: this.sessionCode, sdp: tuned, to: peerId });
              this.logToUI(`📤 Sent renegotiation offer to ${peerId}`);
            });
          });
        });
        this.logToUI('✅ System audio track added to peer connections');
      } else {
        this.logToUI('❌ No audio track found in stream');
        throw new Error('No system audio track available');
      }

      // Do NOT add video tracks to the peer connection; keep them running to allow audio
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length) {
        this.logToUI('ℹ️ Keeping minimal video track alive (not sent) to permit tab audio');
      }
      
      // Handle when user stops sharing
      stream.getTracks().forEach(track => {
        track.onended = () => {
          this.logToUI('🛑 System audio track ended by user');
          this.stopAudioSharing();
        };
      });
      
      // Update UI
      (document.getElementById('start-audio-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
      (document.getElementById('stop-audio-btn') as HTMLButtonElement)?.removeAttribute('disabled');
      
      this.showStatus('🎵 System audio sharing started');
      this.logToUI('🎵 System audio sharing started successfully!');
      console.log('🎵 System audio sharing started');
    } catch (err) {
      console.error('Failed to start system audio sharing:', err);
      this.logToUI(`❌ System audio sharing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      this.showError(`Could not start system audio sharing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private isSystemAudioSupported(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    // Best effort: Chrome/Edge desktop generally support tab/system audio via getDisplayMedia
    const isChromeLike = /chrome|edg\//.test(ua) && !/mobile/.test(ua);
    if (isIOS) return false;
    if (isSafari) return false;
    if (!('getDisplayMedia' in (navigator.mediaDevices as any))) return false;
    return isChromeLike;
  }

  private tuneOpusInSdp(sdp: string): string {
    try {
      const lines = sdp.split(/\r?\n/);
      const rtpmapIndex = lines.findIndex((l) => /a=rtpmap:\d+ opus\//i.test(l));
      if (rtpmapIndex === -1) return sdp;
      const ptMatch = lines[rtpmapIndex].match(/a=rtpmap:(\d+)/);
      if (!ptMatch) return sdp;
      const pt = ptMatch[1];
      const fmtpIndex = lines.findIndex((l) => new RegExp(`^a=fmtp:${pt}`).test(l));
      const tune = 'stereo=1;sprop-stereo=1;maxaveragebitrate=160000;maxplaybackrate=48000;ptime=10;minptime=10;usedtx=1';
      if (fmtpIndex >= 0) {
        if (lines[fmtpIndex].includes(' ')) {
          lines[fmtpIndex] = lines[fmtpIndex] + ';' + tune;
        } else {
          lines[fmtpIndex] = `a=fmtp:${pt} ${tune}`;
        }
      } else {
        lines.splice(rtpmapIndex + 1, 0, `a=fmtp:${pt} ${tune}`);
      }
      return lines.join('\r\n');
    } catch {
      return sdp;
    }
  }

  private stopAudioSharing() {
    if (!this.isSharingAudio || !this.audioStream) return;
    
    this.logToUI('🔇 Stopping audio sharing...');
    this.audioStream.getTracks().forEach(track => track.stop());
    this.audioStream = null;
    this.isSharingAudio = false;
    
    // Update UI
    (document.getElementById('start-audio-btn') as HTMLButtonElement)?.removeAttribute('disabled');
    (document.getElementById('stop-audio-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
    
    this.showStatus('🔇 Audio sharing stopped');
    this.logToUI('🔇 Audio sharing stopped');
    console.log('🔇 Audio sharing stopped');
  }

  private logToUI(message: string) {
    const logContent = document.getElementById('log-content');
    const devLogs = document.getElementById('dev-logs');
    
    if (logContent) {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = document.createElement('div');
      logEntry.textContent = `[${timestamp}] ${message}`;
      logEntry.style.marginBottom = '4px';
      logContent.appendChild(logEntry);
      
      // Auto-scroll to bottom
      logContent.scrollTop = logContent.scrollHeight;
    }
    
    // Show logs in development mode
    if (import.meta.env.DEV && devLogs) {
      devLogs.classList.remove('hidden');
    }
    
    console.log(`[UI LOG] ${message}`);
  }

  private updateUI(mode: 'initial' | 'host' | 'listener') {
    const hostSection = document.getElementById('host-section');
    const joinSection = document.getElementById('join-section');
    const controls = document.getElementById('controls');
    const createBtn = document.getElementById('create-session-btn') as HTMLButtonElement;
    const joinBtn = document.getElementById('join-session-btn') as HTMLButtonElement;

    // Reset all sections
    hostSection?.classList.add('hidden');
    joinSection?.classList.add('hidden');
    controls?.classList.add('hidden');

    if (mode === 'initial') {
      hostSection?.classList.remove('hidden');
      joinSection?.classList.remove('hidden');
      createBtn.disabled = false;
      joinBtn.disabled = false;
    } else if (mode === 'host') {
      hostSection?.classList.remove('hidden');
      controls?.classList.remove('hidden');
      createBtn.disabled = true;
      joinBtn.disabled = true;
    } else if (mode === 'listener') {
      joinSection?.classList.remove('hidden');
      controls?.classList.remove('hidden');
      createBtn.disabled = true;
      joinBtn.disabled = true;
    }
  }

  private startKeepAlive() {
    // Ping the backend every 5 minutes to keep it awake
    setInterval(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 
          (import.meta.env.DEV ? 'http://localhost:3000' : 'https://sync-up-nsnr.onrender.com');
        
        await fetch(`${backendUrl}/ping`);
        console.log('🔄 Keep-alive ping sent');
      } catch (error) {
        console.log('⚠️ Keep-alive ping failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Sync App initializing...');
  console.log('Environment:', {
    DEV: import.meta.env.DEV,
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    location: window.location.href
  });
  
  try {
    new SyncApp();
    console.log('✅ Sync App initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Sync App:', error);
  }
});
