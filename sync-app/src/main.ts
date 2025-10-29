import { io } from 'socket.io-client';

class SyncApp {
  private socket: any = null;
  private sessionCode: string | null = null;
  private isHost: boolean = false;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private micMuted: boolean = false;
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
    const toggleMicBtn = document.getElementById('toggle-mic-btn') as HTMLButtonElement;
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
    toggleMicBtn?.addEventListener('click', () => this.toggleMic());
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
    });

    this.socket.on('participant-left', (data: any) => {
      console.log('Participant left:', data.id);
      this.showStatus(`Participant left (${data.id})`);
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
        await this.ensurePeerConnection();
        this.logToUI('📝 Creating offer...');
        const offer = await this.peerConnection!.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await this.peerConnection!.setLocalDescription(offer);
        this.socket.emit('offer', { code: code || this.sessionCode, sdp: offer, to });
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
        await this.ensurePeerConnection();
        this.logToUI('📝 Setting remote description...');
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(sdp));
        this.logToUI('📝 Creating answer...');
        const answer = await this.peerConnection!.createAnswer();
        await this.peerConnection!.setLocalDescription(answer);
        this.socket.emit('answer', { code: code || this.sessionCode, sdp: answer, to: from });
        this.logToUI(`📤 Sent answer to ${from}`);
        console.log('📨 Sent answer to', from);
      } catch (err) {
        this.logToUI(`❌ Failed to handle offer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to handle offer:', err);
      }
    });

    // Signaling: receive answer
    this.socket.on('answer', async ({ sdp }: any) => {
      try {
        this.logToUI('📨 Received answer');
        if (!this.peerConnection) return;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        this.logToUI('✅ Remote description set from answer');
        console.log('✅ Remote description set from answer');
      } catch (err) {
        this.logToUI(`❌ Failed to handle answer: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Failed to handle answer:', err);
      }
    });

    // Signaling: receive ICE candidate
    this.socket.on('ice-candidate', async ({ candidate }: any) => {
      try {
        this.logToUI(`🧊 Received ICE candidate: ${candidate.candidate.substring(0, 50)}...`);
        if (!this.peerConnection || !candidate) return;
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
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

  private async ensurePeerConnection() {
    if (this.peerConnection) {
      this.logToUI('♻️ Using existing peer connection');
      return;
    }
    
    this.logToUI('🔧 Creating new peer connection...');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
      ]
    });
    this.peerConnection = pc;
    this.logToUI('✅ Peer connection created');

    pc.onicecandidate = (event) => {
      if (event.candidate && this.sessionCode) {
        this.logToUI(`🧊 ICE candidate generated: ${event.candidate.candidate.substring(0, 50)}...`);
        this.socket?.emit('ice-candidate', { code: this.sessionCode, candidate: event.candidate });
      } else if (event.candidate) {
        this.logToUI('🧊 ICE candidate generated (no session code)');
      } else {
        this.logToUI('🧊 ICE gathering complete');
      }
    };

    pc.ontrack = (event) => {
      this.logToUI(`📺 Remote track received: ${event.track.kind}`);
      const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement | null;
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
        this.logToUI('✅ Remote video stream attached');
      }
    };

    pc.onconnectionstatechange = () => {
      this.logToUI(`🔗 Connection state: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      this.logToUI(`🧊 ICE connection state: ${pc.iceConnectionState}`);
    };

    // If we already have local tracks, add them to the new PC
    if (this.localStream) {
      this.logToUI(`📡 Adding ${this.localStream.getTracks().length} local tracks to peer connection`);
      this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));
    }
    if (this.screenTrack) {
      this.logToUI('📡 Adding screen track to peer connection');
      const screenStream = new MediaStream([this.screenTrack]);
      screenStream.getTracks().forEach((t) => pc.addTrack(t, screenStream));
    }
  }

  private async startCamera() {
    try {
      if (this.localStream) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      this.localStream = stream;
      const localVideo = document.getElementById('local-video') as HTMLVideoElement | null;
      if (localVideo) localVideo.srcObject = stream;

      await this.ensurePeerConnection();
      stream.getTracks().forEach((t) => this.peerConnection!.addTrack(t, stream));

      // Enable related controls
      (document.getElementById('stop-camera-btn') as HTMLButtonElement)?.removeAttribute('disabled');
      (document.getElementById('toggle-mic-btn') as HTMLButtonElement)?.removeAttribute('disabled');
    } catch (err) {
      console.error('Failed to start camera:', err);
      this.showError('Could not access camera/microphone');
    }
  }

  private stopCamera() {
    if (!this.localStream) return;
    this.localStream.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    const localVideo = document.getElementById('local-video') as HTMLVideoElement | null;
    if (localVideo) localVideo.srcObject = null;
    (document.getElementById('stop-camera-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
    (document.getElementById('toggle-mic-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
  }

  private toggleMic() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    this.micMuted = !this.micMuted;
    audioTrack.enabled = !this.micMuted;
    const btn = document.getElementById('toggle-mic-btn') as HTMLButtonElement | null;
    if (btn) btn.textContent = this.micMuted ? 'Unmute Mic' : 'Mute Mic';
  }

  private async startScreenShare() {
    try {
      if (this.screenTrack) return;
      // @ts-ignore Edge/Chrome
      const displayStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      const track = displayStream.getVideoTracks()[0];
      this.screenTrack = track;

      await this.ensurePeerConnection();
      const sender = this.replaceOrAddVideoTrack(track);

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
    if (!this.peerConnection) return null;
    const senders = this.peerConnection.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
    if (videoSender) {
      videoSender.replaceTrack(track);
      return videoSender;
    }
    const dummyStream = new MediaStream([track]);
    return this.peerConnection.addTrack(track, dummyStream);
  }

  private async startAudioSharing() {
    try {
      if (this.isSharingAudio) return;
      
      this.logToUI('🎵 Starting audio sharing...');
      
      // Try to get microphone audio first (no screen sharing required)
      let stream: MediaStream;
      try {
        this.logToUI('📱 Requesting microphone access...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });
        this.logToUI('✅ Microphone access granted');
      } catch (micError) {
        this.logToUI('⚠️ Microphone access denied, trying system audio...');
        // Fallback to system audio (requires screen sharing)
        stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: false, 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        this.logToUI('✅ System audio access granted');
      }
      
      this.audioStream = stream;
      this.isSharingAudio = true;
      
      this.logToUI('🔌 Setting up peer connection...');
      await this.ensurePeerConnection();
      
      // Add audio track to peer connection
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        this.logToUI(`📡 Adding audio track: ${audioTrack.label}`);
        const dummyStream = new MediaStream([audioTrack]);
        this.peerConnection!.addTrack(audioTrack, dummyStream);
        this.logToUI('✅ Audio track added to peer connection');
      } else {
        this.logToUI('❌ No audio track found in stream');
        throw new Error('No audio track available');
      }
      
      // Handle when user stops sharing
      stream.getTracks().forEach(track => {
        track.onended = () => {
          this.logToUI('🛑 Audio track ended by user');
          this.stopAudioSharing();
        };
      });
      
      // Update UI
      (document.getElementById('start-audio-btn') as HTMLButtonElement)?.setAttribute('disabled', 'true');
      (document.getElementById('stop-audio-btn') as HTMLButtonElement)?.removeAttribute('disabled');
      
      this.showStatus('🎵 Audio sharing started');
      this.logToUI('🎵 Audio sharing started successfully!');
      console.log('🎵 Audio sharing started');
    } catch (err) {
      console.error('Failed to start audio sharing:', err);
      this.logToUI(`❌ Audio sharing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      this.showError(`Could not start audio sharing: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
