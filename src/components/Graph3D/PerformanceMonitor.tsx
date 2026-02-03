import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { usePerformanceStore } from '../../store/usePerformanceStore';
import toast from 'react-hot-toast';

export const PerformanceMonitor = () => {
  const { setFps, quality, setQuality } = usePerformanceStore();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const lowFpsCount = useRef(0); // Consecutive checks with low FPS

  useFrame(() => {
    frameCount.current++;
    const time = performance.now();
    
    // Update every 1 second
    if (time >= lastTime.current + 1000) {
      const fps = Math.round((frameCount.current * 1000) / (time - lastTime.current));
      setFps(fps);
      
      // Auto-downgrade logic
      if (quality === 'high' && fps < 30) {
        lowFpsCount.current++;
        if (lowFpsCount.current >= 5) { // 5 consecutive seconds of low FPS
          toast((t) => (
            <div className="flex flex-col gap-2">
              <span className="font-bold">检测到性能较低 ({fps} FPS)</span>
              <span className="text-sm">建议降低画质以获得更流畅的体验。</span>
              <button 
                className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
                onClick={() => {
                  setQuality('medium');
                  toast.dismiss(t.id);
                  toast.success('已切换至中等画质');
                }}
              >
                切换至中等画质
              </button>
            </div>
          ), { duration: 6000, id: 'perf-warning' }); // Unique ID to prevent spam
          lowFpsCount.current = 0; // Reset
        }
      } else {
        lowFpsCount.current = 0;
      }

      frameCount.current = 0;
      lastTime.current = time;
    }
  });

  return null; // Logic only, UI is handled by StatsOverview or GraphSettings
};
