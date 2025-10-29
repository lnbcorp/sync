import { io } from 'socket.io-client';

class SyncApp {
  private socket: any = null;
  private sessionCode: string | null = null;
  private isHost: boolean = false;

  constructor() {
    this.initializeEventListeners();
    this.startKeepAlive();
  }

  private initializeEventListeners() {
    const createBtn = document.getElementById('create-session-btn') as HTMLButtonElement;
    const joinBtn = document.getElementById('join-session-btn') as HTMLButtonElement;
    const leaveBtn = document.getElementById('leave-session-btn') as HTMLButtonElement;
    const joinCodeInput = document.getElementById('join-code') as HTMLInputElement;

    createBtn?.addEventListener('click', () => this.createSession());
    joinBtn?.addEventListener('click', () => this.joinSession());
    leaveBtn?.addEventListener('click', () => this.leaveSession());
    
    joinCodeInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinSession();
      }
    });
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
