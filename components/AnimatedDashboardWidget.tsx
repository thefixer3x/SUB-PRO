import React from 'react';
import Animated from 'react-native-reanimated';
import { useStaggeredAnimation } from '@/hooks/useAnimatedEntry';
import { useRenderCount } from '@/hooks/useRenderCount';
import { DashboardWidget } from './DashboardWidget';
import { DashboardWidget as WidgetType } from '@/types/subscription';

interface AnimatedDashboardWidgetProps {
  widget: WidgetType;
  index: number;
  children: React.ReactNode;
}

export const AnimatedDashboardWidget: React.FC<AnimatedDashboardWidgetProps> = ({
  widget,
  index,
  children,
}) => {
  const { animatedStyle } = useStaggeredAnimation(index, {
    duration: 300,
    initialOpacity: 0,
    initialTranslateY: -10,
  });

  // Performance monitoring
  useRenderCount({
    componentName: `DashboardWidget-${widget.id}`,
    threshold: 3,
  });

  return (
    <Animated.View style={animatedStyle}>
      <DashboardWidget widget={widget}>
        {children}
      </DashboardWidget>
    </Animated.View>
  );
};