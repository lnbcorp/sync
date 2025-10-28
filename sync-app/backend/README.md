# Sync Backend - Render Deployment

## Overview
This is the Node.js backend for the Sync audio streaming app. It handles:
- WebRTC signaling server
- Session management
- Real-time communication via Socket.io

## Render Deployment

### 1. Deploy to Render
1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Choose the `sync-app/backend` directory
6. Render will auto-detect Node.js and deploy

### 2. Configuration
- **Build Command**: `pnpm install`
- **Start Command**: `node src/server.js`
- **Node Version**: 18+ (auto-detected)

### 3. Environment Variables
Set these in Render dashboard:
```
NODE_ENV=production
CORS_ORIGIN=*
REDIS_URL=memory
SESSION_TTL_SECONDS=1800
PORT=3000
```

### 4. Get Backend URL
After deployment, Render provides a URL like:
```
https://your-app-name.onrender.com
```

### 5. Update Frontend
Update the frontend environment variable:
```
VITE_BACKEND_URL=https://your-app-name.onrender.com
```

## Local Development
```bash
cd backend
pnpm install
pnpm run dev
```

## Health Check
Visit: `https://your-app-name.onrender.com/health`

## Render Advantages
- ✅ Free tier (750 hours/month)
- ✅ WebSocket support
- ✅ Auto-deploy from GitHub
- ✅ Custom domains
- ✅ Environment variables
- ✅ No credit card required

## Features
- ✅ Session creation/joining
- ✅ WebRTC signaling
- ✅ Real-time communication
- ✅ CORS enabled
- ✅ Health monitoring