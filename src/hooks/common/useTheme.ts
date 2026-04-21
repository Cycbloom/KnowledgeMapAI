import React, { useState, useEffect, createContext, useContext } from 'react';
import type { ThemePreset } from '../../types';
import { getAvailablePresets } from '../../config/themePresets';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
  availablePresets: { key: ThemePreset; name: string; previewColor: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedThemeMode = localStorage.getItem('themeMode') as ThemeMode;
    return savedThemeMode || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  const [themePreset, setThemePresetState] = useState<ThemePreset>(() => {
    const savedPreset = localStorage.getItem('themePreset') as ThemePreset;
    return savedPreset || 'default';
  });

  const setThemePreset = (preset: ThemePreset) => {
    setThemePresetState(preset);
    localStorage.setItem('themePreset', preset);
  };

  const availablePresets = getAvailablePresets();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateResolvedTheme = () => {
      if (themeMode === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      } else {
        setResolvedTheme(themeMode);
      }
    };

    updateResolvedTheme();

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

    const presetClasses = Array.from(root.classList).filter(c => c.startsWith('theme-'));
    presetClasses.forEach(c => root.classList.remove(c));
    root.classList.add(`theme-${themePreset}`);

    localStorage.setItem('themeMode', themeMode);
  }, [resolvedTheme, themeMode, themePreset]);

  const toggleTheme = () => {
    setThemeMode(_prev => (resolvedTheme === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const value = {
    theme: resolvedTheme,
    themeMode,
    setTheme,
    toggleTheme,
    isDark: resolvedTheme === 'dark',
    themePreset,
    setThemePreset,
    availablePresets,
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
