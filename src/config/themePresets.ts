import type { ThemePreset } from '../types';

interface PrimaryScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

interface ThemePresetConfig {
  name: string;
  primary: PrimaryScale;
  accent: string;
  previewColor: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemePresetConfig> = {
  default: {
    name: 'settings.themePreset.default',
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    accent: '#0ea5e9',
    previewColor: '#0ea5e9',
  },
  ocean: {
    name: 'settings.themePreset.ocean',
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    accent: '#3b82f6',
    previewColor: '#3b82f6',
  },
  forest: {
    name: 'settings.themePreset.forest',
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    accent: '#22c55e',
    previewColor: '#22c55e',
  },
  sunset: {
    name: 'settings.themePreset.sunset',
    primary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
    accent: '#f97316',
    previewColor: '#f97316',
  },
  lavender: {
    name: 'settings.themePreset.lavender',
    primary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7c3aed',
      800: '#6d28d9',
      900: '#581c87',
    },
    accent: '#a855f7',
    previewColor: '#a855f7',
  },
  rose: {
    name: 'settings.themePreset.rose',
    primary: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
    },
    accent: '#f43f5e',
    previewColor: '#f43f5e',
  },
  midnight: {
    name: 'settings.themePreset.midnight',
    primary: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
    accent: '#6366f1',
    previewColor: '#6366f1',
  },
};

export function getThemePreset(preset: ThemePreset): ThemePresetConfig {
  return THEME_PRESETS[preset] ?? THEME_PRESETS.default;
}

export function getAvailablePresets(): { key: ThemePreset; name: string; previewColor: string }[] {
  return (Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => ({
    key,
    name: THEME_PRESETS[key].name,
    previewColor: THEME_PRESETS[key].previewColor,
  }));
}
