// Performance monitoring utilities
import { Platform } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  bundleSize: number;
  memoryUsage: number;
  navigationTime: number;
}

interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitor {
  private marks: Map<string, PerformanceMark> = new Map();
  private metrics: Partial<PerformanceMetrics> = {};
  private enabled: boolean = true;

  constructor() {
    this.enabled = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true';
    
    if (this.enabled) {
      this.initializeMonitoring();
    }
  }

  private initializeMonitoring() {
    if (Platform.OS === 'web' && typeof performance !== 'undefined') {
      // Web performance monitoring
      this.monitorWebVitals();
    } else {
      // Mobile performance monitoring
      this.monitorMobilePerformance();
    }
  }

  private monitorWebVitals() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor Core Web Vitals
      this.observePerformance();
    }
  }

  private observePerformance() {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.renderTime = lastEntry.startTime;
        console.log('LCP:', lastEntry.startTime);
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP observation not supported');
      }

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          // Cast to any to access processingStart for FID entries
          const fidEntry = entry as any;
          if (fidEntry.processingStart) {
            console.log('FID:', fidEntry.processingStart - entry.startTime);
          }
        });
      });

      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID observation not supported');
      }
    }
  }

  private monitorMobilePerformance() {
    // Monitor React Native performance metrics
    if (Platform.OS !== 'web') {
      // Memory usage monitoring (simplified)
      setInterval(() => {
        if (global.gc && __DEV__) {
          const used = process.memoryUsage();
          this.metrics.memoryUsage = used.heapUsed / 1024 / 1024; // MB
        }
      }, 10000);
    }
  }

  public startMark(name: string): void {
    if (!this.enabled) return;

    const startTime = this.getTime();
    this.marks.set(name, {
      name,
      startTime,
    });

    if (Platform.OS === 'web' && typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  public endMark(name: string): number | null {
    if (!this.enabled) return null;

    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`Performance mark "${name}" not found`);
      return null;
    }

    const endTime = this.getTime();
    const duration = endTime - mark.startTime;
    
    mark.duration = duration;

    if (Platform.OS === 'web' && typeof performance !== 'undefined') {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    }

    console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
    return duration;
  }

  public measureComponentRender(componentName: string, renderFn: () => void): void {
    if (!this.enabled) {
      renderFn();
      return;
    }

    this.startMark(`render-${componentName}`);
    renderFn();
    this.endMark(`render-${componentName}`);
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  public logMetrics(): void {
    if (!this.enabled) return;

    console.group('Performance Metrics');
    Object.entries(this.metrics).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.groupEnd();
  }

  public cleanup(): void {
    this.marks.clear();
    this.metrics = {};
  }

  public getTime(): number {
    if (Platform.OS === 'web' && typeof performance !== 'undefined') {
      return performance.now();
    }
    return Date.now();
  }

  // Bundle size monitoring (development only)
  public setBundleSize(size: number): void {
    if (__DEV__) {
      this.metrics.bundleSize = size;
      console.log(`Bundle size: ${(size / 1024).toFixed(2)} KB`);
    }
  }

  // Navigation timing
  public markNavigation(routeName: string): void {
    this.startMark(`navigation-${routeName}`);
  }

  public endNavigation(routeName: string): void {
    const duration = this.endMark(`navigation-${routeName}`);
    if (duration !== null) {
      this.metrics.navigationTime = duration;
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions
export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T => {
  return ((...args: any[]) => {
    performanceMonitor.startMark(name);
    const result = fn(...args);
    performanceMonitor.endMark(name);
    return result;
  }) as T;
};

export const measureAsync = async <T>(
  fn: () => Promise<T>,
  name: string
): Promise<T> => {
  performanceMonitor.startMark(name);
  try {
    const result = await fn();
    return result;
  } finally {
    performanceMonitor.endMark(name);
  }
};

// React hook for component performance tracking
export const usePerformanceTracking = (componentName: string) => {
  const startTime = performanceMonitor.getTime();
  
  return {
    markRender: () => {
      const renderTime = performanceMonitor.getTime() - startTime;
      console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
    },
  };
};