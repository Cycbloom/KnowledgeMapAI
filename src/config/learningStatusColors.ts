import { LearningStatus } from '../types';

export interface ColorConfig {
  primary: string;
  secondary: string;
  glow: string;
  background: string;
  text: string;
}

export const LEARNING_STATUS_COLORS: Record<LearningStatus, ColorConfig> = {
  mastered: {
    primary: '#10B981',
    secondary: '#34D399',
    glow: '#6EE7B7',
    background: '#ECFDF5',
    text: '#065F46'
  },
  due: {
    primary: '#F59E0B',
    secondary: '#FBBF24',
    glow: '#FCD34D',
    background: '#FFFBEB',
    text: '#92400E'
  },
  locked: {
    primary: '#6B7280',
    secondary: '#9CA3AF',
    glow: '#D1D5DB',
    background: '#F3F4F6',
    text: '#374151'
  },
  new: {
    primary: '#3B82F6',
    secondary: '#60A5FA',
    glow: '#93C5FD',
    background: '#EFF6FF',
    text: '#1E40AF'
  },
  learning: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    glow: '#C4B5FD',
    background: '#F5F3FF',
    text: '#5B21B6'
  }
};

export const THEME_COLORS = {
  dark: {
    background: '#0F172A',
    grid: '#1E293B',
    text: '#F1F5F9',
    link: '#38BDF8',
    linkHighlight: '#60A5FA'
  },
  light: {
    background: '#F8FAFC',
    grid: '#E2E8F0',
    text: '#0F172A',
    link: '#64748B',
    linkHighlight: '#475569'
  }
};

export const getLearningStatus = (
  nodeStatus: { locked: boolean; mastered: boolean; due_today?: boolean; due?: boolean; review_count?: number } | undefined
): LearningStatus => {
  if (!nodeStatus) return 'new';
  
  if (nodeStatus.locked) return 'locked';
  if (nodeStatus.mastered) return 'mastered';
  if (nodeStatus.due_today || nodeStatus.due) return 'due';
  if (nodeStatus.review_count && nodeStatus.review_count > 0) return 'learning';
  
  return 'new';
};

export const getStatusColors = (status: LearningStatus, isDark: boolean = false): ColorConfig => {
  const colors = LEARNING_STATUS_COLORS[status];
  
  if (isDark) {
    return {
      ...colors,
      background: adjustColorForDarkMode(colors.background),
      text: adjustColorForDarkMode(colors.text)
    };
  }
  
  return colors;
};

const adjustColorForDarkMode = (color: string): string => {
  const colorMap: Record<string, string> = {
    '#ECFDF5': '#064E3B',
    '#FFFBEB': '#78350F',
    '#F3F4F6': '#1F2937',
    '#EFF6FF': '#1E3A8A',
    '#F5F3FF': '#4C1D95'
  };
  
  return colorMap[color] || color;
};