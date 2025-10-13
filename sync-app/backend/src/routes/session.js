import { Router } from 'express';
import { generateCode } from '../utils/codeGenerator.js';

export function createSessionRouter({ redis, ttlSeconds }) {
  const router = Router();

  router.post('/create', async (req, res) => {
    try {
      let code;
      // ensure uniqueness (retry few times)
      for (let i = 0; i < 5; i++) {
        code = generateCode();
        const exists = await redis.exists(`session:${code}`);
        if (!exists) break;
      }
      const key = `session:${code}`;
      const now = Date.now();
      await redis.set(key, JSON.stringify({ code, createdAt: now }), 'EX', ttlSeconds);
      return res.json({ code, expiresIn: ttlSeconds });
    } catch (err) {
      console.error('create session error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.post('/join', async (req, res) => {
    try {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'code required' });
      const key = `session:${code}`;
      const val = await redis.get(key);
      if (!val) return res.status(404).json({ error: 'session not found' });
      // bump TTL on join
      await redis.expire(key, ttlSeconds);
      return res.json({ ok: true });
    } catch (err) {
      console.error('join session error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.post('/leave', async (req, res) => {
    try {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'code required' });
      const key = `session:${code}`;
      const val = await redis.get(key);
      if (!val) return res.status(404).json({ error: 'session not found' });
      // do not delete session; listeners may come/go. Just acknowledge.
      return res.json({ ok: true });
    } catch (err) {
      console.error('leave session error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
