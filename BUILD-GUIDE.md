# Build and Deployment Guide

## Quick Start

### Prerequisites
1. EAS CLI installed: `npm install -g eas-cli`
2. Authenticated: `eas login`
3. Project initialized: `eas init`

### Build Commands

#### Production Builds
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production

# Both platforms
eas build --platform all --profile production
```

#### Development Builds
```bash
# Android
eas build --platform android --profile development

# iOS
eas build --platform ios --profile development
```

#### Preview Builds
```bash
# Android
eas build --platform android --profile preview

# iOS
eas build --platform ios --profile preview
```

### OTA Updates
```bash
# Production branch
eas update --branch production --message "Production update"

# Preview branch
eas update --branch preview --message "Preview update"
```

### GitHub Actions

The repository includes automated build workflows. To use them:

1. Set up `EXPO_TOKEN` in GitHub Secrets
2. Go to Actions tab
3. Run the workflow manually or push to main branch

### Checking Build Status
```bash
# List recent builds
eas build:list --limit 10

# View specific build
eas build:view [BUILD_ID]
```

### Download Artifacts
After builds complete, download the artifacts from the Expo dashboard or use the URLs provided in the build output.

## Troubleshooting

- If builds fail, check the logs with `eas build:view [BUILD_ID]`
- Clear cache with `--clear-cache` flag if needed
- Ensure all environment variables are properly set
