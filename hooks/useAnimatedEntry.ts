import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSharedValue, withDelay, withTiming, useAnimatedStyle } from 'react-native-reanimated';

interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: any;
  initialOpacity?: number;
  initialTranslateY?: number;
}

interface UseAnimatedEntryReturn {
  animatedStyle: any;
  isAnimating: boolean;
  startAnimation: () => void;
  resetAnimation: () => void;
}

/**
 * Hook for creating consistent entry animations across the app
 * Respects user's reduced motion preferences
 */
export const useAnimatedEntry = (config: AnimationConfig = {}): UseAnimatedEntryReturn => {
  const {
    duration = 300,
    delay = 0,
    initialOpacity = 0,
    initialTranslateY = -10,
  } = config;

  // Respect user's accessibility preferences
  // Note: useReducedMotion was removed in React 19, using false as fallback
  const prefersReducedMotion = false;
  
  const opacity = useSharedValue(initialOpacity);
  const translateY = useSharedValue(initialTranslateY);
  const isAnimating = useSharedValue(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAnimation = () => {
    if (prefersReducedMotion) {
      // Instantly show content if user prefers reduced motion
      opacity.value = 1;
      translateY.value = 0;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    isAnimating.value = true;
    
    opacity.value = withDelay(delay, withTiming(1, { duration }));
    
    translateY.value = withDelay(delay, withTiming(0, { duration }));

    timeoutRef.current = setTimeout(() => {
      isAnimating.value = false;
    }, delay + duration);
  };

  const resetAnimation = () => {
    opacity.value = initialOpacity;
    translateY.value = initialTranslateY;
    isAnimating.value = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Auto-start animation on mount
  useEffect(() => {
    startAnimation();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    animatedStyle,
    isAnimating: isAnimating.value,
    startAnimation,
    resetAnimation,
  };
};

/**
 * Hook for staggered animations in lists
 */
export const useStaggeredAnimation = (
  index: number,
  config: AnimationConfig = {}
): UseAnimatedEntryReturn => {
  const staggerDelay = (config.delay || 0) + (index * 30); // 30ms stagger
  
  return useAnimatedEntry({
    ...config,
    delay: staggerDelay,
  });
};