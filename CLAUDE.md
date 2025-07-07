# Claude Code - Project Configuration

## EAS Robot Token Setup ✅

This project is configured with an EAS Robot Token for automated builds and deployments.

### GitHub Secrets Configured:
- `EAS_ROBOT_TOKEN`: `y0KiSuc9mkqi5dJuHs3ByLzUTocRxHFsYs73tdhW`
- All AdMob credentials (ADMOB_APP_ID, ADMOB_BANNER_ID, etc.)
- Stripe and Supabase environment variables

### Robot Token Capabilities:
- ✅ Non-interactive EAS builds
- ✅ Automated credential management  
- ✅ iOS/Android app submissions
- ✅ CI/CD pipeline automation

### Claude Code Commands:
```bash
# Trigger builds
gh workflow run enhanced-eas-build.yml -f platform=all -f profile=production

# Check build status
gh run list --workflow=enhanced-eas-build.yml --limit=3

# Submit to app stores (once builds complete)
eas submit --platform all --non-interactive
```

### Project Structure:
- **Mobile App**: React Native with Expo (iOS + Android)
- **Bundle ID**: `com.lanonasis.subpro` 
- **AdMob Integration**: Configured with live ad units
- **Stripe Integration**: React Native compatible setup
- **Build System**: EAS Build with GitHub Actions

### Important Notes:
- API routes (`app/api/*`) are excluded from mobile builds via metro.config.js
- Server-side Stripe code is separated in `services/stripe-server.ts`
- Robot token eliminates interactive authentication issues
- All credentials are managed through EAS and GitHub Secrets

### For Future Claude Sessions:
The robot token allows Claude to:
1. Trigger builds without authentication prompts
2. Submit apps to stores automatically
3. Manage EAS credentials programmatically
4. Debug build issues with full access

This setup ensures consistent, automated mobile app deployment pipeline.