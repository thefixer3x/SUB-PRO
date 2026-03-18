# AdMob & AdSense Integration Guide

This document explains how SubTrack Pro integrates with Google AdMob (mobile) and Google AdSense (web) for monetization.

## Configuration

### Environment Variables

The app uses the following environment variables for ad configuration:

```bash
# AdMob Configuration (Mobile)
EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx
EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx

# AdSense Configuration (Web)
EXPO_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-xxxxxxxxxxxxxxxx
EXPO_PUBLIC_ADSENSE_SLOT_ID=xxxxxxxxxx

# Feature Flags
EXPO_PUBLIC_MONETIZATION_V1=true
```

### Ad Frequency Settings

The monetization system includes smart frequency controls:

- **Banner Ads**: Every 5 minutes
- **Interstitial Ads**: Every 15 minutes
- **Maximum Ads per Hour**: 6 ads
- **Ad-Free Experience**: Pro and Team tiers

## Ad Placements

### Banner Ads
- **Home Screen**: Bottom banner
- **Subscriptions List**: Between subscription groups
- **Analytics Page**: Below charts
- **Community Stats**: Bottom of screen

### Interstitial Ads
- **App Launch**: After 3rd app open
- **Navigation**: Between major sections (limited frequency)
- **Feature Access**: When accessing premium features on free tier

### Rewarded Ads
- **Premium Features**: Unlock advanced analytics temporarily
- **Virtual Cards**: Generate additional virtual cards
- **Export Data**: Export to premium formats

## Integration Steps

### 1. AdMob Setup (Mobile)

1. **Create AdMob Account**
   - Go to [AdMob Console](https://admob.google.com/)
   - Create a new app or link existing app
   - Note your App ID

2. **Create Ad Units**
   - Banner: 320x50 standard banner
   - Interstitial: Full-screen ad
   - Rewarded: Video reward ad

3. **Update Configuration**
   ```bash
   # Replace with your actual IDs
   EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-1234567890123456~1234567890
   EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-1234567890123456/1234567890
   ```

### 2. AdSense Setup (Web)

1. **Create AdSense Account**
   - Go to [Google AdSense](https://www.google.com/adsense/)
   - Add your domain: your-app-domain.com
   - Get approval for your site

2. **Create Ad Units**
   - Responsive display ads
   - In-article ads for content pages
   - Anchor ads for mobile web

3. **Update Configuration**
   ```bash
   EXPO_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-1234567890123456
   EXPO_PUBLIC_ADSENSE_SLOT_ID=1234567890
   ```

### 3. EAS Build Configuration

Use the provided script to set up EAS secrets:

```bash
# Make script executable
chmod +x scripts/setup-eas-secrets.sh

# Run setup script
./scripts/setup-eas-secrets.sh
```

Or manually set secrets:

```bash
eas secret:create --scope project --name ADMOB_APP_ID --value "your_app_id"
eas secret:create --scope project --name ADMOB_BANNER_ID --value "your_banner_id"
# ... etc
```

### 4. App.json Configuration

Update your `app.json` with AdMob App IDs:

```json
{
  "expo": {
    // ... other config
  },
  "react-native-google-mobile-ads": {
    "android_app_id": "ca-app-pub-1234567890123456~1234567890",
    "ios_app_id": "ca-app-pub-1234567890123456~0987654321"
  }
}
```

## Testing

### Test Ad Units

For development, use Google's test ad units:

```typescript
const TEST_AD_UNITS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917'
};
```

### Testing Checklist

- [ ] Ads load correctly on free tier
- [ ] Ads are hidden on pro/team tiers
- [ ] Frequency limits are respected
- [ ] Ads don't interfere with core functionality
- [ ] Revenue tracking works
- [ ] Ad blocking is handled gracefully

## Revenue Optimization

### A/B Testing
- Test different ad placements
- Experiment with frequency settings
- Compare banner vs interstitial performance

### User Experience
- Ensure ads don't disrupt core workflows
- Provide clear upgrade paths to remove ads
- Monitor user retention metrics

### Analytics
- Track ad impressions and clicks
- Monitor revenue per user
- Analyze conversion to paid tiers

## Compliance

### Privacy Policy
Ensure your privacy policy covers:
- Ad personalization
- Data collection by ad networks
- User choice in ad preferences

### GDPR/CCPA
- Implement consent management
- Provide opt-out mechanisms
- Honor data deletion requests

## Troubleshooting

### Common Issues

1. **Ads not showing**
   - Check environment variables
   - Verify ad unit IDs
   - Ensure user is on free tier

2. **Build failures**
   - Verify AdMob App ID in app.json
   - Check EAS secrets configuration
   - Review plugin configurations

3. **Revenue discrepancies**
   - Compare AdMob/AdSense reports
   - Check for ad blocking
   - Verify tracking implementation

### Debug Mode

Enable debug logging:

```typescript
import { adConfig } from '@/config/monetization';

console.log('Ad Config:', adConfig);
console.log('Should show ads:', shouldShowAds(currentTier));
```

## Next Steps

1. **Implement Native SDK**: Add react-native-google-mobile-ads
2. **Advanced Targeting**: Implement user behavior targeting
3. **Revenue Analytics**: Build comprehensive revenue dashboard
4. **A/B Testing**: Test different ad strategies
5. **Mediation**: Consider multiple ad networks

For questions or issues, refer to:
- [AdMob Documentation](https://developers.google.com/admob)
- [AdSense Help Center](https://support.google.com/adsense)
- [Expo AdMob Guide](https://docs.expo.dev/versions/latest/sdk/admob/)
