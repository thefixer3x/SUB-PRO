# Deploy VortexCore SaaS to Netlify

## Quick Deploy Options:

### Option 1: Direct GitHub Import (Recommended)
1. **Go to:** https://app.netlify.com/start
2. **Click** "Import from Git"
3. **Choose** GitHub
4. **Select** `thefixer3x/vortexcore-saas` repository
5. **Branch:** VortexCore
6. **Site name:** vortexcore-saas
7. **Click** "Deploy site"

### Option 2: One-Click Deploy Link
Click this link to deploy directly:
https://app.netlify.com/start/deploy?repository=https://github.com/thefixer3x/vortexcore-saas

### Option 3: Manual CLI Deploy
```bash
# If you have the repo locally
cd /path/to/vortexcore-saas
netlify deploy --prod --dir=dist
```

## After Deployment:

1. **Get your Netlify URL** (will be like: vortexcore-saas.netlify.app)

2. **Add Custom Domain in Netlify:**
   - Go to Domain settings
   - Add domain alias: `saas.vortexcore.app`

3. **Configure DNS** (in your DNS provider):
   ```
   Type: CNAME
   Name: saas
   Value: vortexcore-saas.netlify.app
   TTL: 3600
   ```

4. **SSL Certificate** will be automatically provisioned by Netlify

## Build Settings (if needed):
- **Build command:** `npm run build` or `yarn build`
- **Publish directory:** `dist` or `build`
- **Node version:** 18.x or later