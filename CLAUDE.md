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

### Claude Code Setup:
The robot token is configured in `.env.local` so Claude can use EAS commands directly:
```bash
# Token is already set via .env.local
# Claude can run EAS commands without authentication prompts
eas whoami  # Should show: thefixer3x
```

### Claude Code Commands:
```bash
# Validate before building (FREE - saves money!)
./scripts/pre-build-check.sh

# Trigger builds
gh workflow run enhanced-eas-build.yml -f platform=all -f profile=production

# Check build status
gh run list --workflow=enhanced-eas-build.yml --limit=3

# Submit to app stores (once builds complete)
eas submit --platform all --non-interactive

# Direct EAS builds (use sparingly - costs money!)
eas build --platform android --profile production --non-interactive
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

## 💰 Cost-Saving Measures

**EAS charges for each build attempt, even failures!** 

### Pre-Build Validation:
```bash
# ALWAYS run this before triggering EAS builds
./scripts/pre-build-check.sh

# Only trigger EAS build if validation passes
gh workflow run enhanced-eas-build.yml -f platform=all -f profile=production
```

### Automated Safeguards:
- ✅ Pre-build bundle testing in GitHub Actions
- ✅ TypeScript validation before EAS build
- ✅ Metro bundler validation for both platforms
- ✅ App configuration validation

### Build Failure Prevention:
1. **Never trigger EAS builds with TypeScript errors**
2. **Always test Metro bundling locally first**
3. **Use preview profiles for testing, production for releases**
4. **Single platform builds for faster iteration**

### Cost-Effective Workflow:
```bash
# 1. Validate locally (FREE)
./scripts/pre-build-check.sh

# 2. Test single platform first (CHEAPER)
gh workflow run enhanced-eas-build.yml -f platform=android -f profile=preview

# 3. Full production build only when ready (EXPENSIVE)
gh workflow run enhanced-eas-build.yml -f platform=all -f profile=production
```

**Remember**: Each failed build costs money. Validation is free!