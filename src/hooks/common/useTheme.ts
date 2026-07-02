import React, { useState, useEffect, createContext, useContext } from 'react';
import type { ThemePreset } from '../../types';
import { getAvailablePresets } from '../../config/themePresets';
import { useThemeStore } from '../../store/useThemeStore';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
  availablePresets: { key: ThemePreset; name: string; previewColors: string[] }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeMode = useThemeStore((s) => s.themeMode);
  const themePreset = useThemeStore((s) => s.themePreset);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const setThemePresetStore = useThemeStore((s) => s.setThemePreset);

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

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
  }, [resolvedTheme, themeMode, themePreset]);

  const toggleTheme = () => {
    setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const setThemePreset = (preset: ThemePreset) => {
    setThemePresetStore(preset);
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
