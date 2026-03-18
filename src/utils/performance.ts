import { request } from '../services/api';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface WebVitals {
  LCP?: number;
  FID?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
  INP?: number;
}

const metrics: PerformanceMetric[] = [];

const getRating = (name: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
  const thresholds: Record<string, [number, number]> = {
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };

  const [good, poor] = thresholds[name] || [0, 0];
  
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
};

const observePerformance = (): void => {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      const value = lastEntry.startTime;
      
      metrics.push({
        name: 'LCP',
        value,
        rating: getRating('LCP', value),
        timestamp: Date.now(),
      });
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if ('processingStart' in entry) {
          const value = (entry as PerformanceEventTiming).processingStart - entry.startTime;
          
          metrics.push({
            name: 'FID',
            value,
            rating: getRating('FID', value),
            timestamp: Date.now(),
          });
        }
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if ('value' in entry && !(entry as LayoutShift).hadRecentInput) {
          clsValue += (entry as LayoutShift).value;
        }
      });
      
      metrics.push({
        name: 'CLS',
        value: clsValue,
        rating: getRating('CLS', clsValue),
        timestamp: Date.now(),
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const inpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if ('processingStart' in entry) {
          const eventEntry = entry as PerformanceEventTiming;
          const value = eventEntry.processingStart - entry.startTime;
          
          metrics.push({
            name: 'INP',
            value,
            rating: getRating('INP', value),
            timestamp: Date.now(),
          });
        }
      });
    });
    inpObserver.observe({ type: 'event', buffered: true });

  } catch (error) {
    console.warn('[Performance] Observer setup failed:', error);
  }
};

const measureNavigationTiming = (): void => {
  if (typeof performance === 'undefined') return;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return;

  const ttfb = navigation.responseStart - navigation.requestStart;
  metrics.push({
    name: 'TTFB',
    value: ttfb,
    rating: getRating('TTFB', ttfb),
    timestamp: Date.now(),
  });

  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  if (fcp) {
    metrics.push({
      name: 'FCP',
      value: fcp.startTime,
      rating: getRating('FCP', fcp.startTime),
      timestamp: Date.now(),
    });
  }
};

const reportMetrics = async (): Promise<void> => {
  if (metrics.length === 0) return;

  const webVitals: WebVitals = {};
  
  metrics.forEach((metric) => {
    if (metric.name in webVitals) {
      const existing = webVitals[metric.name as keyof WebVitals];
      if (existing === undefined || metric.value > existing) {
        webVitals[metric.name as keyof WebVitals] = metric.value;
      }
    } else {
      webVitals[metric.name as keyof WebVitals] = metric.value;
    }
  });

  console.log('[Performance] Web Vitals:', webVitals);

  try {
    await request('/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metrics: webVitals,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn('[Performance] Report error:', error);
  }
};

export const initPerformanceMonitoring = (): void => {
  if (typeof window === 'undefined') return;

  observePerformance();

  if (document.readyState === 'complete') {
    measureNavigationTiming();
  } else {
    window.addEventListener('load', measureNavigationTiming);
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      reportMetrics();
    }
  });

  window.addEventListener('pagehide', reportMetrics);
};

export const getPerformanceMetrics = (): PerformanceMetric[] => {
  return [...metrics];
};

export const getWebVitals = (): WebVitals => {
  const webVitals: WebVitals = {};
  
  metrics.forEach((metric) => {
    const key = metric.name as keyof WebVitals;
    if (key in webVitals) {
      const existing = webVitals[key];
      if (existing === undefined || metric.value > existing) {
        webVitals[key] = metric.value;
      }
    } else {
      webVitals[key] = metric.value;
    }
  });

  return webVitals;
};

export const clearPerformanceMetrics = (): void => {
  metrics.length = 0;
};

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}
