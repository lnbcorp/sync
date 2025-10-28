import { io } from 'socket.io-client';

class SyncApp {
  private socket: any = null;
  private sessionCode: string | null = null;
  private isHost: boolean = false;

  constructor() {
    this.initializeEventListeners();
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
      
      const response = await fetch(`${backendUrl}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
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
      this.showError(`Failed to join session: ${error.message}`);
      console.error('Join session error:', error);
    }
  }

  private connectToSocket() {
    if (!this.sessionCode) return;

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
      (import.meta.env.DEV ? 'http://localhost:3000' : 'https://your-backend-url.railway.app');

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
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
      this.showError(data.message);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.showError('Connection lost. Please try again.');
    });
  }

  private async leaveSession() {
    if (this.sessionCode) {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 
          (import.meta.env.DEV ? 'http://localhost:3000' : 'https://your-backend-url.onrender.com');
        
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
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SyncApp();
});
