# Sync App - Complete Deployment Guide

## Architecture Overview
- **Backend**: Node.js/Express (Railway) - WebRTC signaling server
- **Frontend**: Web app (Vercel) - User interface
- **Mobile**: Flutter app (Separate deployment) - Mobile clients

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Connect your repository

### 1.2 Deploy Backend
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Choose the `sync-app/backend` directory
4. Railway will auto-detect Node.js and deploy

### 1.3 Configure Environment Variables
In Railway dashboard, add:
```
NODE_ENV=production
CORS_ORIGIN=*
REDIS_URL=memory
SESSION_TTL_SECONDS=1800
PORT=3000
```

### 1.4 Get Backend URL
After deployment, Railway provides a URL like:
```
https://your-app-name.railway.app
```

## Step 2: Deploy Frontend to Vercel

### 2.1 Update Frontend Configuration
1. In Vercel dashboard, go to your project settings
2. Add environment variable:
```
VITE_BACKEND_URL=https://your-app-name.railway.app
```

### 2.2 Deploy Frontend
1. Root Directory: `sync-app`
2. Build Command: `pnpm run vercel-build`
3. Output Directory: `web/dist`
4. Install Command: `pnpm install`

## Step 3: Deploy Flutter Mobile App

### 3.1 Android (Google Play Store)
```bash
cd mobile
flutter build apk --release
# Upload to Google Play Console
```

### 3.2 iOS (Apple App Store)
```bash
cd mobile
flutter build ios --release
# Upload to App Store Connect
```

### 3.3 Flutter Web (Optional)
```bash
cd mobile
flutter build web
# Deploy to Vercel or any static hosting
```

## Step 4: Update Mobile App Configuration

### 4.1 Update Backend URL
In your Flutter app, update the backend URL to point to your Railway deployment:

```dart
// In your Flutter app configuration
const String backendUrl = 'https://your-app-name.railway.app';
```

## Step 5: Test the Complete System

### 5.1 Test Backend
Visit: `https://your-app-name.railway.app/health`
Should return: `{"ok": true}`

### 5.2 Test Frontend
1. Visit your Vercel URL
2. Try creating a session
3. Check browser console for any errors

### 5.3 Test Mobile App
1. Install on device
2. Try joining a session created from web
3. Test audio streaming

## Environment Variables Summary

### Railway (Backend)
```
NODE_ENV=production
CORS_ORIGIN=*
REDIS_URL=memory
SESSION_TTL_SECONDS=1800
PORT=3000
```

### Vercel (Frontend)
```
VITE_BACKEND_URL=https://your-app-name.railway.app
```

### Flutter (Mobile)
Update the backend URL in your Flutter app configuration.

## Troubleshooting

### Backend Issues
- Check Railway logs
- Verify environment variables
- Test health endpoint

### Frontend Issues
- Check Vercel build logs
- Verify environment variables
- Check browser console

### Mobile Issues
- Check network connectivity
- Verify backend URL
- Check device permissions

## Cost Estimation
- **Railway**: Free tier (750 hours/month)
- **Vercel**: Free tier (100GB bandwidth)
- **Google Play**: $25 one-time fee
- **Apple App Store**: $99/year

## Next Steps
1. Deploy backend to Railway
2. Deploy frontend to Vercel
3. Update URLs in mobile app
4. Test complete system
5. Deploy mobile apps to stores
