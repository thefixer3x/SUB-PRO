/**
 * SubscriptionLogo
 * Displays a brand logo fetched via logoService with graceful fallback chain:
 *   logo.dev  →  Clearbit  →  Google Favicon  →  colored initial avatar
 */
import React, { useState } from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { getLogoUrls } from '@/services/logoService';

interface SubscriptionLogoProps {
  /** Subscription name (e.g. "Netflix") or domain (e.g. "netflix.com") */
  name: string;
  /** Explicit logo URL – skips the service lookup if provided */
  logoUrl?: string;
  /** Brand color used for the fallback initial avatar */
  color?: string;
  /** Size in logical pixels (default: 40) */
  size?: number;
  /** Border radius (default: size / 4) */
  borderRadius?: number;
  style?: object;
}

export const SubscriptionLogo: React.FC<SubscriptionLogoProps> = ({
  name,
  logoUrl,
  color = '#6B7280',
  size = 40,
  borderRadius,
  style,
}) => {
  const radius = borderRadius ?? Math.round(size / 4);
  const urls = logoUrl ? null : getLogoUrls(name, size * 2); // 2× for high-DPI

  // Track which source we're on: 0 = explicit/primary, 1 = secondary, 2 = fallback, 3 = initials
  const sources: string[] = [];
  if (logoUrl) sources.push(logoUrl);
  if (urls) {
    sources.push(urls.primary, urls.secondary, urls.fallback);
  }

  const [sourceIndex, setSourceIndex] = useState(0);

  const handleError = () => {
    setSourceIndex((prev) => prev + 1);
  };

  const currentSrc = sources[sourceIndex];

  if (currentSrc) {
    return (
      <View style={[styles.wrapper, { width: size, height: size, borderRadius: radius }, style]}>
        <Image
          source={{ uri: currentSrc }}
          style={[styles.image, { width: size, height: size, borderRadius: radius }]}
          onError={handleError}
          resizeMode="contain"
        />
      </View>
    );
  }

  // Fallback: colored circle with first initial
  const initial = name?.charAt(0)?.toUpperCase() ?? '?';
  const fontSize = Math.round(size * 0.45);

  return (
    <View
      style={[
        styles.initial,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
        style,
      ]}
    >
      <Text style={[styles.initialText, { fontSize }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: 'transparent',
  },
  initial: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: 'white',
    fontWeight: '700',
  },
});
