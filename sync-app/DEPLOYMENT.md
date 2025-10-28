# Sync App - Vercel Deployment Guide

## Overview
This project is configured for deployment on Vercel with the following components:
- **Backend**: Node.js/Express server with Socket.io for real-time communication
- **Frontend**: Vite-built React-like web application
- **Mobile**: Flutter app (not deployed on Vercel)

## Deployment Steps

### 1. Prerequisites
- Vercel account
- Node.js 20+ installed locally
- pnpm package manager

### 2. Environment Variables
Set these environment variables in your Vercel dashboard:
```
NODE_ENV=production
CORS_ORIGIN=*
REDIS_URL=memory
SESSION_TTL_SECONDS=1800
```

### 3. Deploy to Vercel
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the configuration from `vercel.json`
3. The build process will:
   - Build the web frontend using Vite
   - Deploy the backend as a serverless function
   - Configure routing for API and Socket.io endpoints

### 4. Build Process
- **Web App**: Built using `vite build` in the `web/` directory
- **Backend**: Deployed as a Vercel serverless function
- **Static Assets**: Served from the `web/dist/` directory

## Project Structure
```
sync-app/
├── backend/          # Node.js/Express backend
├── web/             # Vite frontend
├── mobile/          # Flutter mobile app
├── shared/          # Shared TypeScript types
├── vercel.json      # Vercel deployment configuration
└── package.json     # Root package configuration
```

## Features
- Real-time audio streaming sessions
- Session creation and joining via 6-character codes
- WebRTC signaling server
- In-memory Redis for session management
- Responsive web interface

## Development
```bash
# Install dependencies
pnpm install

# Run development servers
pnpm run dev

# Run linting
pnpm run lint

# Build for production
pnpm run build
```

## Notes
- The app uses in-memory Redis by default (sessions are not persistent)
- For production, consider using a real Redis instance
- WebRTC connections are peer-to-peer after initial signaling
- Mobile app requires separate deployment (not included in Vercel deployment)
