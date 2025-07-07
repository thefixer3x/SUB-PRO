import React from 'react';
import Animated from 'react-native-reanimated';
import { useStaggeredAnimation } from '@/hooks/useAnimatedEntry';
import { useRenderCount } from '@/hooks/useRenderCount';
import { SubscriptionCard } from './SubscriptionCard';
import { Subscription } from '@/types/subscription';

interface AnimatedSubscriptionCardProps {
  subscription: Subscription;
  index: number;
  onPress?: () => void;
}

export const AnimatedSubscriptionCard: React.FC<AnimatedSubscriptionCardProps> = ({
  subscription,
  index,
  onPress,
}) => {
  const { animatedStyle } = useStaggeredAnimation(index, {
    duration: 300,
    initialOpacity: 0,
    initialTranslateY: -10,
  });

  // Performance monitoring
  useRenderCount({
    componentName: `SubscriptionCard-${subscription.id}`,
    threshold: 3,
  });

  return (
    <Animated.View style={animatedStyle}>
      <SubscriptionCard subscription={subscription} onPress={onPress} />
    </Animated.View>
  );
};