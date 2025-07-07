import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedTabBadgeProps {
  show: boolean;
  count?: number;
  type: 'number' | 'dot';
  color: 'red' | 'green' | 'blue';
}

const COLORS = {
  red: '#EF4444',
  green: '#10B981',
  blue: '#3B82F6',
};

export const AnimatedTabBadge: React.FC<AnimatedTabBadgeProps> = ({
  show,
  count,
  type,
  color,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (show) {
      // Entrance animation with bounce effect
      scale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withSpring(1, { damping: 15, stiffness: 300 })
      );
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      // Exit animation
      scale.value = withTiming(0, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [show]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!show) return null;

  const badgeColor = COLORS[color];
  const showNumber = type === 'number' && count && count > 0;

  return (
    <Animated.View 
      style={[
        styles.badge,
        type === 'dot' ? styles.dot : styles.numberBadge,
        { backgroundColor: badgeColor },
        animatedStyle,
      ]}
    >
      {showNumber && (
        <Text style={styles.badgeText}>
          {count! > 99 ? '99+' : count!.toString()}
        </Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  numberBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    textAlign: 'center',
  },
});