import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  cardId: string;
}

/**
 * Native: the full number and CVC are never shown in the app. Stripe's secure
 * card display (Issuing Elements) is web-only, so the app points there.
 */
export function CardRevealPanel(_props: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        Only the last 4 digits are shown in the app. View full card details on the web at
        sub-pro.lanonasis.com.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12 },
  text: { fontSize: 13, lineHeight: 18 },
});
