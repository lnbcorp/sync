import Redis from 'ioredis';

export function createRedisClient(url) {
  if (url === 'memory') {
    const store = new Map();
    const expiries = new Map();

    // const now = () => Date.now();

    function _setExpiry(key, seconds) {
      if (expiries.has(key)) clearTimeout(expiries.get(key));
      const t = setTimeout(() => {
        store.delete(key);
        expiries.delete(key);
      }, seconds * 1000);
      expiries.set(key, t);
    }

    return {
      async exists(key) {
        return store.has(key) ? 1 : 0;
      },
      async set(key, value, mode, seconds) {
        store.set(key, value);
        if (mode === 'EX' && typeof seconds === 'number') {
          _setExpiry(key, seconds);
        }
        return 'OK';
      },
      async get(key) {
        return store.get(key) ?? null;
      },
      async expire(key, seconds) {
        if (!store.has(key)) return 0;
        _setExpiry(key, seconds);
        return 1;
      },
      disconnect() {}
    };
  }

  // default: real Redis
  return new Redis(url);
}
