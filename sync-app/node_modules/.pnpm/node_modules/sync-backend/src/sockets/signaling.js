import { Server } from 'socket.io';

export function initSignaling(httpServer, { redis, corsOrigin = '*' }) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    let joinedCode = null;

    socket.on('join', async ({ code }) => {
      if (!code) return;
      const exists = await redis.exists(`session:${code}`);
      if (!exists) {
        socket.emit('error', { message: 'session not found' });
        return;
      }
      await socket.join(code);
      joinedCode = code;
      io.to(code).emit('participant-joined', { id: socket.id });
      // Ask existing peers (e.g., host) to send an offer specifically to this newly joined socket
      socket.to(code).emit('request-offer', { to: socket.id, code });
    });

    socket.on('offer', ({ code, sdp, to }) => {
      if (!code || !sdp) return;
      if (to) {
        io.to(to).emit('offer', { from: socket.id, sdp, code });
      } else if (joinedCode) {
        socket.to(code || joinedCode).emit('offer', { from: socket.id, sdp, code: code || joinedCode });
      }
    });

    socket.on('answer', ({ code, sdp, to }) => {
      if (!code || !sdp) return;
      if (to) {
        io.to(to).emit('answer', { from: socket.id, sdp, code });
      } else if (joinedCode) {
        socket.to(code || joinedCode).emit('answer', { from: socket.id, sdp, code: code || joinedCode });
      }
    });

    socket.on('ice-candidate', ({ code, candidate, to }) => {
      if (!code || !candidate) return;
      if (to) {
        io.to(to).emit('ice-candidate', { from: socket.id, candidate, code });
      } else if (joinedCode) {
        socket.to(code || joinedCode).emit('ice-candidate', { from: socket.id, candidate, code: code || joinedCode });
      }
    });

    socket.on('disconnect', () => {
      if (joinedCode) io.to(joinedCode).emit('participant-left', { id: socket.id });
    });
  });

  return io;
}
