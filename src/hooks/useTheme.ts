import React, { useState, useEffect, createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // User's selected mode
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedThemeMode = localStorage.getItem('themeMode') as ThemeMode;
    // Migrate old 'theme' key if exists and 'themeMode' doesn't
    if (!savedThemeMode) {
      const oldTheme = localStorage.getItem('theme');
      if (oldTheme === 'light' || oldTheme === 'dark') {
        return oldTheme;
      }
      return 'system';
    }
    return savedThemeMode;
  });

  // The actual active theme (light or dark)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (themeMode === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(themeMode);
      }
    };

    // Initial update
    updateResolvedTheme();

    // Listen for changes
    const handler = () => {
      if (themeMode === 'system') {
        updateResolvedTheme();
      }
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    
    // Save current mode preference
    localStorage.setItem('themeMode', themeMode);
    // Maintain 'theme' for compatibility or simple checks
    localStorage.setItem('theme', resolvedTheme);
  }, [resolvedTheme, themeMode]);

  const toggleTheme = () => {
    // Toggling always exits system mode and switches to the opposite of current resolved theme
    setThemeMode(prev => (resolvedTheme === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const value = {
    theme: resolvedTheme,
    themeMode,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark'
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
