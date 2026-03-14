import { useEffect, useRef, useCallback, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
}

interface ComponentPerformanceOptions {
  enabled?: boolean;
  logThreshold?: number;
  onSlowRender?: (metrics: PerformanceMetrics) => void;
}

const performanceMetrics: PerformanceMetrics[] = [];
const MAX_METRICS = 100;

export const useComponentPerformance = (
  componentName: string,
  options: ComponentPerformanceOptions = {}
) => {
  const { enabled = process.env.NODE_ENV === 'development', logThreshold = 16, onSlowRender } = options;
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    renderStartTime.current = performance.now();
    const currentRenderCount = renderCount.current;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      const renderNum = currentRenderCount + 1;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      renderCount.current++;

      const metrics: PerformanceMetrics = {
        renderTime,
        componentName,
        timestamp: Date.now(),
      };

      if (performanceMetrics.length >= MAX_METRICS) {
        performanceMetrics.shift();
      }
      performanceMetrics.push(metrics);

      if (renderTime > logThreshold) {
        console.warn(
          `[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render (render #${renderNum})`
        );

        if (onSlowRender) {
          onSlowRender(metrics);
        }
      }
    };
  }, [enabled, componentName, logThreshold, onSlowRender]);

  const getMetrics = useCallback(() => {
    return performanceMetrics.filter(m => m.componentName === componentName);
  }, [componentName]);

  const getAverageRenderTime = useCallback(() => {
    const componentMetrics = getMetrics();
    if (componentMetrics.length === 0) return 0;
    return componentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / componentMetrics.length;
  }, [getMetrics]);

  return {
    renderCount: renderCount.current,
    getMetrics,
    getAverageRenderTime,
  };
};

export const useRenderCount = (_componentName: string) => {
  const count = useRef(0);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    count.current += 1;
    setRenderCount(count.current);
  }, []);

  return renderCount;
};

export const useWhyDidYouRender = (componentName: string, props: Record<string, unknown>) => {
  const previousProps = useRef<Record<string, unknown>>(props);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const changedProps: Record<string, { from: unknown; to: unknown }> = {};
    let hasChanges = false;

    for (const key in props) {
      if (previousProps.current[key] !== props[key]) {
        changedProps[key] = {
          from: previousProps.current[key],
          to: props[key],
        };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      console.info(`[${componentName}] Re-rendered due to prop changes:`, changedProps);
    }

    previousProps.current = props;
  });
};

export const getPerformanceReport = (): {
  slowComponents: PerformanceMetrics[];
  averageRenderTimes: Record<string, number>;
  totalRenders: number;
} => {
  const slowComponents = performanceMetrics.filter(m => m.renderTime > 16);
  
  const averageRenderTimes: Record<string, number> = {};
  const componentCounts: Record<string, number> = {};

  performanceMetrics.forEach(m => {
    if (!averageRenderTimes[m.componentName]) {
      averageRenderTimes[m.componentName] = 0;
      componentCounts[m.componentName] = 0;
    }
    averageRenderTimes[m.componentName] += m.renderTime;
    componentCounts[m.componentName]++;
  });

  Object.keys(averageRenderTimes).forEach(component => {
    averageRenderTimes[component] /= componentCounts[component];
  });

  return {
    slowComponents,
    averageRenderTimes,
    totalRenders: performanceMetrics.length,
  };
};

export const clearPerformanceMetrics = () => {
  performanceMetrics.length = 0;
};
