# Render Deployment Guide

## Overview
This guide will help you deploy your Commute Dashboard to Render with proper API key security.

## Prerequisites
- Render account (https://render.com)
- Google Maps API key
- OpenWeather API key

## Deployment Steps

### 1. Push Code to GitHub
Make sure your latest code is pushed to your GitHub repository.

### 2. Create a New Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `jdudgeon1993/Personal-Commute`
4. Configure the service:
   - **Name**: `personal-commute-dashboard` (or your preferred name)
   - **Region**: Choose closest to you (e.g., Oregon)
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: Leave blank
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or upgrade as needed)

### 3. Add Environment Variables

In the Render dashboard, scroll to **"Environment Variables"** section and add:

| Key | Value | Notes |
|-----|-------|-------|
| `GOOGLE_MAPS_API_KEY` | `your_actual_key_here` | From Google Cloud Console |
| `OPENWEATHER_API_KEY` | `your_actual_key_here` | From OpenWeather |
| `NODE_ENV` | `production` | Optional |

⚠️ **Important**: Never commit these keys to your repository!

### 4. Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Run `npm install`
   - Start your server with `npm start`
   - Assign a URL like `https://personal-commute-dashboard.onrender.com`

### 5. Verify Deployment

Once deployed, visit your Render URL and verify:
- [ ] Site loads correctly
- [ ] Weather data displays
- [ ] Drive times calculate
- [ ] N Line transit data loads
- [ ] Search locator works with address input

## Troubleshooting

### Check Logs
If something isn't working:
1. Go to your service in Render dashboard
2. Click **"Logs"** tab
3. Look for error messages

### Common Issues

**"API key not found" warnings**:
- Verify environment variables are set correctly in Render
- Make sure variable names match exactly (case-sensitive)

**"Cannot GET /"**:
- Check that `index.html` is in the root directory
- Verify server.js is serving static files correctly

**CORS errors**:
- Should not occur since frontend and backend are same origin
- If you see CORS errors, verify API_BASE_URL in frontend

### Health Check
Visit `https://your-app.onrender.com/health` to verify the server is running.

## Making the Repository Public

Now that API keys are secure in environment variables:

1. Go to your GitHub repository settings
2. Navigate to **Settings** → **General**
3. Scroll to **"Danger Zone"**
4. Click **"Change visibility"**
5. Select **"Make public"**

✅ Your API keys are safe - they're only in Render's environment variables, not in the code!

## Auto-Deploy

Render automatically deploys when you push to your configured branch. To trigger a manual deploy:
1. Go to Render dashboard
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

## Custom Domain (Optional)

To use a custom domain:
1. In Render dashboard, go to **"Settings"** → **"Custom Domains"**
2. Add your domain
3. Follow DNS configuration instructions

## Support

- Render Docs: https://render.com/docs
- Community: https://community.render.com
