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
      // Emit current room size to everyone
      const size = io.sockets.adapter.rooms.get(code)?.size || 0;
      io.to(code).emit('room-size', { size });
      // If a source was already set for this room, send it to the newly joined socket
      const src = await redis.get(`session:${code}:source`);
      if (src) {
        socket.emit('source-update', { source: src, from: 'server' });
      }
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

    // latency measurement
    socket.on('ping', ({ ts, code }) => {
      socket.emit('pong', { ts, code });
    });

    // source label update (e.g., YouTube/Netflix/Spotify)
    socket.on('source-update', async ({ code, source }) => {
      if (!code || typeof source !== 'string') return;
      await redis.set(`session:${code}:source`, source);
      io.to(code).emit('source-update', { source, from: socket.id });
    });

    socket.on('disconnect', () => {
      if (joinedCode) io.to(joinedCode).emit('participant-left', { id: socket.id });
      if (joinedCode) {
        const size = io.sockets.adapter.rooms.get(joinedCode)?.size || 0;
        io.to(joinedCode).emit('room-size', { size });
      }
    });
  });

  return io;
}
