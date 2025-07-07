import { useRef, useEffect } from 'react';

interface RenderCountOptions {
  enabled?: boolean;
  threshold?: number;
  timeWindow?: number;
  componentName?: string;
}

interface RenderInfo {
  count: number;
  timestamps: number[];
  averageRenderTime: number;
  lastRenderTime: number;
}

/**
 * Hook for monitoring component render performance
 * Only active in development builds to avoid production overhead
 */
export const useRenderCount = (options: RenderCountOptions = {}): RenderInfo => {
  const {
    enabled = __DEV__,
    threshold = 3,
    timeWindow = 2000, // 2 seconds
    componentName = 'Unknown Component',
  } = options;

  const renderCount = useRef(0);
  const renderTimestamps = useRef<number[]>([]);
  const lastRenderTime = useRef(0);
  const renderStartTime = useRef(0);

  // Start timing this render
  renderStartTime.current = performance.now();

  useEffect(() => {
    if (!enabled) return;

    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;
    
    renderCount.current += 1;
    lastRenderTime.current = renderDuration;
    
    const now = Date.now();
    renderTimestamps.current.push(now);

    // Remove timestamps outside the time window
    renderTimestamps.current = renderTimestamps.current.filter(
      timestamp => now - timestamp <= timeWindow
    );

    // Check if render count exceeds threshold within time window
    if (renderTimestamps.current.length > threshold) {
      console.warn(
        `🐌 Performance Warning: ${componentName} rendered ${renderTimestamps.current.length} times in ${timeWindow}ms`,
        {
          totalRenders: renderCount.current,
          recentRenders: renderTimestamps.current.length,
          lastRenderTime: `${renderDuration.toFixed(2)}ms`,
          timestamps: renderTimestamps.current,
        }
      );

      // Optional: Add performance mark for debugging
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark(`render-warning-${componentName}-${Date.now()}`);
      }
    }

    // Development-only logging for render tracking
    if (__DEV__ && renderCount.current % 10 === 0) {
      console.log(`📊 ${componentName} render stats:`, {
        totalRenders: renderCount.current,
        averageRenderTime: getAverageRenderTime(),
        lastRenderTime: `${renderDuration.toFixed(2)}ms`,
      });
    }
  });

  const getAverageRenderTime = (): number => {
    if (renderTimestamps.current.length === 0) return 0;
    return lastRenderTime.current; // Simplified for this implementation
  };

  return {
    count: renderCount.current,
    timestamps: [...renderTimestamps.current],
    averageRenderTime: getAverageRenderTime(),
    lastRenderTime: lastRenderTime.current,
  };
};

/**
 * Higher-order component wrapper for render counting
 */
export const withRenderCount = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> => {
  const WrappedComponent = (props: P) => {
    useRenderCount({ 
      componentName: componentName || Component.displayName || Component.name 
    });
    
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withRenderCount(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
};