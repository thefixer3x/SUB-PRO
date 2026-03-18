# VortexCore SaaS Deployment Guide

## Netlify Deployment Steps

1. **Via Netlify UI:**
   - Go to [app.netlify.com](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub and select `vortexcore-saas`
   - Branch: `VortexCore`
   - Build settings will auto-detect

2. **Via Netlify CLI:**
   ```bash
   # Clone locally first
   git clone https://github.com/thefixer3x/vortexcore-saas.git
   cd vortexcore-saas
   
   # Deploy to Netlify
   netlify init
   netlify deploy --prod
   ```

## DNS Configuration for saas.vortexcore.app

After deployment, configure DNS in your provider:

### For Vercel:
```
Type: CNAME
Name: saas
Value: cname.vercel-dns.com
TTL: 3600
```

### For Netlify:
```
Type: CNAME
Name: saas
Value: [your-site-name].netlify.app
TTL: 3600
```

## Add Custom Domain

### Vercel:
1. Go to your project settings
2. Navigate to "Domains"
3. Add `saas.vortexcore.app`

### Netlify:
1. Go to Domain settings
2. Add domain alias
3. Enter `saas.vortexcore.app`