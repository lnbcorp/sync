# Sync Backend - Railway Deployment

## Overview
This is the Node.js backend for the Sync audio streaming app. It handles:
- WebRTC signaling server
- Session management
- Real-time communication via Socket.io

## Railway Deployment

### 1. Deploy to Railway
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Choose the `sync-app/backend` directory
6. Railway will auto-detect Node.js and deploy

### 2. Environment Variables
Set these in Railway dashboard:
```
NODE_ENV=production
CORS_ORIGIN=*
REDIS_URL=memory
SESSION_TTL_SECONDS=1800
PORT=3000
```

### 3. Get Backend URL
After deployment, Railway will provide a URL like:
```
https://your-app-name.railway.app
```

### 4. Update Frontend
Update the frontend environment variable:
```
VITE_BACKEND_URL=https://your-app-name.railway.app
```

## Local Development
```bash
cd backend
pnpm install
pnpm run dev
```

## Health Check
Visit: `https://your-app-name.railway.app/health`

## Features
- ✅ Session creation/joining
- ✅ WebRTC signaling
- ✅ Real-time communication
- ✅ CORS enabled
- ✅ Health monitoring
