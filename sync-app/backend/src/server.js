import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createSessionRouter } from './routes/session.js';
import { initSignaling } from './sockets/signaling.js';
import { createRedisClient } from './utils/redisClient.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const REDIS_URL = process.env.REDIS_URL || 'memory';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 1800);

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const redis = createRedisClient(REDIS_URL);

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/ping', (req, res) => res.json({ pong: Date.now() }));
app.use('/api/session', createSessionRouter({ redis, ttlSeconds: SESSION_TTL_SECONDS }));

const server = http.createServer(app);
initSignaling(server, { redis, corsOrigin: CORS_ORIGIN });

server.listen(PORT, () => {
  console.log(`sync signaling server listening on :${PORT}`);
});
