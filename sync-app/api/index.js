// Vercel serverless function entry point
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { createSessionRouter } from '../backend/src/routes/session.js';
import { initSignaling } from '../backend/src/sockets/signaling.js';
import { createRedisClient } from '../backend/src/utils/redisClient.js';

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const REDIS_URL = process.env.REDIS_URL || 'memory';
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 1800);

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const redis = createRedisClient(REDIS_URL);

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/session', createSessionRouter({ redis, ttlSeconds: SESSION_TTL_SECONDS }));

const server = createServer(app);
initSignaling(server, { redis, corsOrigin: CORS_ORIGIN });

export default server;
