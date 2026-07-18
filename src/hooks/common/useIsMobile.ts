import { useState, useEffect, useMemo } from 'react';
import { debounce } from '@/utils/performanceUtils';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
}

function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    screenWidth: width,
    screenHeight: height,
    orientation: width >= height ? 'landscape' : 'portrait',
  };
}

export function useIsMobile(): DeviceInfo;
export function useIsMobile(breakpoint: number): boolean;
export function useIsMobile(breakpoint?: number): DeviceInfo | boolean {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenWidth: 1024,
        screenHeight: 768,
        orientation: 'landscape',
      };
    }
    return getDeviceInfo();
  });

  const debouncedUpdate = useMemo(
    () =>
      debounce(() => {
        setDeviceInfo(getDeviceInfo());
      }, 100),
    [],
  );

  useEffect(() => {
    const handleResize = () => {
      debouncedUpdate();
    };

    const handleOrientationChange = () => {
      debouncedUpdate();
    };

    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleMediaQueryChange = () => {
      debouncedUpdate();
    };

    setDeviceInfo(getDeviceInfo());

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    mediaQuery.addEventListener('change', handleMediaQueryChange);

    return () => {
      debouncedUpdate.cancel();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      mediaQuery.removeEventListener('change', handleMediaQueryChange);
    };
  }, [debouncedUpdate]);

  if (breakpoint !== undefined) {
    return deviceInfo.screenWidth < breakpoint;
  }

  return deviceInfo;
}
