import { useEffect, useState } from 'react';
import { onLCP, onINP, onCLS, type LCPMetric, type INPMetric, type CLSMetric } from 'web-vitals';

export interface WebVitalMetric {
  name: string;
  value: number;
  rating: string;
}

export interface UseWebVitalsResult {
  lcp: WebVitalMetric | null;
  inp: WebVitalMetric | null;
  cls: WebVitalMetric | null;
}

/**
 * 监控 Web Vitals 指标（LCP、INP、CLS）。
 * 使用 `web-vitals` 库的 onLCP、onINP、onCLS 进行采集。
 * 在开发模式下会将指标输出到控制台。
 */
export function useWebVitals(): UseWebVitalsResult {
  const [lcp, setLcp] = useState<WebVitalMetric | null>(null);
  const [inp, setInp] = useState<WebVitalMetric | null>(null);
  const [cls, setCls] = useState<WebVitalMetric | null>(null);

  useEffect(() => {
    onLCP((metric: LCPMetric) => {
      const data: WebVitalMetric = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      };
      setLcp(data);

      if (import.meta.env.DEV) {
        console.warn(`[WebVitals] LCP: ${metric.value.toFixed(2)}ms (${metric.rating})`);
      }
    });

    onINP((metric: INPMetric) => {
      const data: WebVitalMetric = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      };
      setInp(data);

      if (import.meta.env.DEV) {
        console.warn(`[WebVitals] INP: ${metric.value.toFixed(2)}ms (${metric.rating})`);
      }
    });

    onCLS((metric: CLSMetric) => {
      const data: WebVitalMetric = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
      };
      setCls(data);

      if (import.meta.env.DEV) {
        console.warn(`[WebVitals] CLS: ${metric.value.toFixed(4)} (${metric.rating})`);
      }
    });
  }, []);

  return { lcp, inp, cls };
}