// Performance monitoring utilities
import React from 'react';

export interface PerformanceMetrics {
  componentName: string;
  renderTime: number;
  renderCount: number;
  memoryUsage?: number;
  timestamp: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  memoryUsage: number;
  componentMetrics: Map<string, PerformanceMetrics>;
}

// Global performance tracking store
const performanceMetrics = new Map<string, PerformanceMetrics>();
const performanceHistory: PerformanceSnapshot[] = [];
let isTrackingEnabled = process.env.NODE_ENV === 'development';

/**
 * Enable or disable performance tracking
 */
export const setPerformanceTracking = (enabled: boolean): void => {
  isTrackingEnabled = enabled;
};

/**
 * Start tracking a component's render time
 */
export const startRenderTracking = (componentName: string): (() => void) => {
  if (!isTrackingEnabled) return () => {};

  const startTime = performance.now();

  return () => {
    const renderTime = performance.now() - startTime;
    const existing = performanceMetrics.get(componentName);

    performanceMetrics.set(componentName, {
      componentName,
      renderTime,
      renderCount: (existing?.renderCount || 0) + 1,
      timestamp: Date.now(),
    });

    // Log slow renders (>16ms = potential dropped frames)
    if (renderTime > 16) {
      console.warn(`🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  };
};

/**
 * Get current performance metrics for all tracked components
 */
export const getPerformanceMetrics = (): Map<string, PerformanceMetrics> => {
  return new Map(performanceMetrics);
};

/**
 * Get memory usage information
 */
export const getMemoryUsage = (): number | undefined => {
  // @ts-ignore - performance.memory is not in standard types but available in Chrome
  return performance.memory?.usedJSHeapSize;
};

/**
 * Take a performance snapshot
 */
export const takePerformanceSnapshot = (): PerformanceSnapshot => {
  const snapshot: PerformanceSnapshot = {
    timestamp: Date.now(),
    memoryUsage: getMemoryUsage() || 0,
    componentMetrics: new Map(performanceMetrics),
  };

  performanceHistory.push(snapshot);

  // Keep only last 50 snapshots to prevent memory leaks
  if (performanceHistory.length > 50) {
    performanceHistory.shift();
  }

  return snapshot;
};

/**
 * Get performance history
 */
export const getPerformanceHistory = (): PerformanceSnapshot[] => {
  return [...performanceHistory];
};

/**
 * Calculate performance statistics
 */
export interface PerformanceStats {
  averageRenderTime: number;
  maxRenderTime: number;
  totalRenders: number;
  memoryUsage: number;
  slowRenders: number; // >16ms
}

export const calculatePerformanceStats = (): PerformanceStats => {
  const metrics = Array.from(performanceMetrics.values());

  if (metrics.length === 0) {
    return {
      averageRenderTime: 0,
      maxRenderTime: 0,
      totalRenders: 0,
      memoryUsage: getMemoryUsage() || 0,
      slowRenders: 0,
    };
  }

  const totalRenderTime = metrics.reduce((sum, metric) => sum + metric.renderTime, 0);
  const maxRenderTime = Math.max(...metrics.map(m => m.renderTime));
  const totalRenders = metrics.reduce((sum, metric) => sum + metric.renderCount, 0);
  const slowRenders = metrics.filter(m => m.renderTime > 16).length;

  return {
    averageRenderTime: totalRenderTime / metrics.length,
    maxRenderTime,
    totalRenders,
    memoryUsage: getMemoryUsage() || 0,
    slowRenders,
  };
};

/**
 * React hook for tracking component performance
 */
export const usePerformanceTracking = (componentName: string) => {
  return startRenderTracking(componentName);
};

/**
 * Higher-order component for performance tracking
 */
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const endTracking = usePerformanceTracking(componentName || Component.displayName || 'Unknown');

    React.useEffect(() => {
      endTracking();
    });

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceTracking(${componentName || Component.displayName})`;
  return WrappedComponent;
};

/**
 * Log performance report to console
 */
export const logPerformanceReport = (): void => {
  const stats = calculatePerformanceStats();
  const metrics = getPerformanceMetrics();

  console.group('📊 Performance Report');
  console.log('Memory Usage:', `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
  console.log('Total Renders:', stats.totalRenders);
  console.log('Average Render Time:', `${stats.averageRenderTime.toFixed(2)}ms`);
  console.log('Max Render Time:', `${stats.maxRenderTime.toFixed(2)}ms`);
  console.log('Slow Renders (>16ms):', stats.slowRenders);

  console.group('Component Details:');
  metrics.forEach((metric) => {
    console.log(`${metric.componentName}: ${metric.renderTime.toFixed(2)}ms (${metric.renderCount} renders)`);
  });
  console.groupEnd();

  console.groupEnd();
};

/**
 * React Profiler callback for advanced performance tracking
 */
export const performanceProfiler = (
  id: string,
  _phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  _startTime: number,
  _commitTime: number
): void => {
  if (!isTrackingEnabled) return;

  const metric: PerformanceMetrics = {
    componentName: id,
    renderTime: actualDuration,
    renderCount: 1,
    timestamp: Date.now(),
  };

  const existing = performanceMetrics.get(id);
  if (existing) {
    metric.renderCount = existing.renderCount + 1;
  }

  performanceMetrics.set(id, metric);

  // Log significant performance issues
  if (actualDuration > 16) {
    console.warn(`🐌 Performance issue in ${id}: ${actualDuration.toFixed(2)}ms (base: ${baseDuration.toFixed(2)}ms)`);
  }
};

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = (): void => {
  if (typeof window !== 'undefined') {
    // Take initial snapshot
    takePerformanceSnapshot();

    // Set up periodic snapshots (every 30 seconds)
    setInterval(() => {
      takePerformanceSnapshot();
    }, 30000);

    // Add global performance logging shortcut
    // @ts-ignore
    window.logPerformance = logPerformanceReport;
    // @ts-ignore
    window.getPerformanceStats = calculatePerformanceStats;

    console.log('🚀 Performance monitoring initialized. Use logPerformance() in console for reports.');
  }
};

// Auto-initialize in development
if (process.env.NODE_ENV === 'development') {
  initPerformanceMonitoring();
}
