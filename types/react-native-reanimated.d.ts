declare module 'react-native-reanimated' {
  import React from 'react';
  import { ViewProps, TextProps, ScrollViewProps } from 'react-native';

  export interface AnimatedProps<T> extends T {
    // Add any specific animated props if needed
  }

  export namespace Animated {
    const View: React.ComponentType<ViewProps>;
    const Text: React.ComponentType<TextProps>;
    const ScrollView: React.ComponentType<ScrollViewProps>;
    const FlatList: React.ComponentType<any>;
    function createAnimatedComponent<T>(component: T): React.ComponentType<any>;
  }

  export function useAnimatedStyle(updater: () => any, deps?: any[]): any;
  export function useSharedValue(initialValue: any): { value: any };
  export function withSpring(value: any, config?: any): any;
  export function withTiming(value: any, config?: any): any;
  export function withDelay(delayMS: number, delayedAnimation: any): any;
  export function withSequence(...animations: any[]): any;
  export function withRepeat(animation: any, numberOfReps?: number, reverse?: boolean): any;
  export function interpolate(value: any, inputRange: number[], outputRange: number[], extrapolate?: any): any;
  export function runOnJS(fn: Function): (...args: any[]) => void;
  export function useAnimatedGestureHandler(handlers: any, deps?: any[]): any;
  export function useAnimatedScrollHandler(handler: any, deps?: any[]): any;

  export default Animated;
}