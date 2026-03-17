import { useEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { useNavigate, useLocation } from 'react-router-dom';

export function useMobileInit() {
  const [isMobile, setIsMobile] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
      setIsMobile(isCapacitor);
      return isCapacitor;
    };

    const native = checkMobile();
    if (!native) return;

    const initMobile = async () => {
      try {
        await SplashScreen.hide();
        
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      } catch (error) {
        console.log('StatusBar not available:', error);
      }

      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch (error) {
        console.log('Network status not available:', error);
      }

      Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
        if (!status.connected) {
          console.log('Network disconnected');
        } else {
          console.log('Network connected');
        }
      });
    };

    initMobile();

    const backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
      const publicRoutes = ['/login', '/register'];
      const isPublicRoute = publicRoutes.includes(location.pathname);
      const isGraphRoute = location.pathname.startsWith('/graph/');
      
      if (isPublicRoute || isGraphRoute) {
        App.exitApp();
        return;
      }

      if (location.pathname === '/') {
        App.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
      Network.removeAllListeners();
    };
  }, [location.pathname, navigate]);

  return { isMobile, isOnline };
}

export function useSafeAreaInsets() {
  return {
    top: 'var(--safe-area-inset-top, 0px)',
    bottom: 'var(--safe-area-inset-bottom, 0px)',
    left: 'var(--safe-area-inset-left, 0px)',
    right: 'var(--safe-area-inset-right, 0px)',
  };
}
