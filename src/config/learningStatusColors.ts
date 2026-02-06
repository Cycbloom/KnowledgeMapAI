import { LearningStatus, ColorScheme } from '../types';

export interface ColorConfig {
  primary: string;
  secondary: string;
  glow: string;
  background: string;
  text: string;
  gradient?: {
    enabled: boolean;
    colors: string[];
  };
}

export const LEARNING_STATUS_COLORS: Record<LearningStatus, ColorConfig> = {
  mastered: {
    primary: '#10B981',
    secondary: '#34D399',
    glow: '#6EE7B7',
    background: '#ECFDF5',
    text: '#065F46',
    gradient: {
      enabled: true,
      colors: ['#10B981', '#34D399', '#6EE7B7']
    }
  },
  due: {
    primary: '#F59E0B',
    secondary: '#FBBF24',
    glow: '#FCD34D',
    background: '#FFFBEB',
    text: '#92400E',
    gradient: {
      enabled: true,
      colors: ['#F59E0B', '#FBBF24', '#FCD34D']
    }
  },
  locked: {
    primary: '#6B7280',
    secondary: '#9CA3AF',
    glow: '#D1D5DB',
    background: '#F3F4F6',
    text: '#374151',
    gradient: {
      enabled: true,
      colors: ['#6B7280', '#9CA3AF', '#D1D5DB']
    }
  },
  new: {
    primary: '#3B82F6',
    secondary: '#60A5FA',
    glow: '#93C5FD',
    background: '#EFF6FF',
    text: '#1E40AF',
    gradient: {
      enabled: true,
      colors: ['#3B82F6', '#60A5FA', '#93C5FD']
    }
  },
  learning: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    glow: '#C4B5FD',
    background: '#F5F3FF',
    text: '#5B21B6',
    gradient: {
      enabled: true,
      colors: ['#8B5CF6', '#A78BFA', '#C4B5FD']
    }
  }
};

export const COLOR_SCHEMES: Record<ColorScheme, Record<LearningStatus, ColorConfig>> = {
  default: LEARNING_STATUS_COLORS,
  nature: {
    mastered: {
      primary: '#059669',
      secondary: '#10B981',
      glow: '#34D399',
      background: '#ECFDF5',
      text: '#064E3B',
      gradient: {
        enabled: true,
        colors: ['#059669', '#10B981', '#34D399']
      }
    },
    due: {
      primary: '#D97706',
      secondary: '#F59E0B',
      glow: '#FBBF24',
      background: '#FFFBEB',
      text: '#78350F',
      gradient: {
        enabled: true,
        colors: ['#D97706', '#F59E0B', '#FBBF24']
      }
    },
    locked: {
      primary: '#525252',
      secondary: '#737373',
      glow: '#A3A3A3',
      background: '#F5F5F5',
      text: '#262626',
      gradient: {
        enabled: true,
        colors: ['#525252', '#737373', '#A3A3A3']
      }
    },
    new: {
      primary: '#2563EB',
      secondary: '#3B82F6',
      glow: '#60A5FA',
      background: '#EFF6FF',
      text: '#1E3A8A',
      gradient: {
        enabled: true,
        colors: ['#2563EB', '#3B82F6', '#60A5FA']
      }
    },
    learning: {
      primary: '#7C3AED',
      secondary: '#8B5CF6',
      glow: '#A78BFA',
      background: '#F5F3FF',
      text: '#4C1D95',
      gradient: {
        enabled: true,
        colors: ['#7C3AED', '#8B5CF6', '#A78BFA']
      }
    }
  },
  ocean: {
    mastered: {
      primary: '#0891B2',
      secondary: '#06B6D4',
      glow: '#22D3EE',
      background: '#ECFEFF',
      text: '#164E63',
      gradient: {
        enabled: true,
        colors: ['#0891B2', '#06B6D4', '#22D3EE']
      }
    },
    due: {
      primary: '#EA580C',
      secondary: '#F97316',
      glow: '#FB923C',
      background: '#FFF7ED',
      text: '#7C2D12',
      gradient: {
        enabled: true,
        colors: ['#EA580C', '#F97316', '#FB923C']
      }
    },
    locked: {
      primary: '#475569',
      secondary: '#64748B',
      glow: '#94A3B8',
      background: '#F8FAFC',
      text: '#1E293B',
      gradient: {
        enabled: true,
        colors: ['#475569', '#64748B', '#94A3B8']
      }
    },
    new: {
      primary: '#0369A1',
      secondary: '#0EA5E9',
      glow: '#38BDF8',
      background: '#F0F9FF',
      text: '#0C4A6E',
      gradient: {
        enabled: true,
        colors: ['#0369A1', '#0EA5E9', '#38BDF8']
      }
    },
    learning: {
      primary: '#4F46E5',
      secondary: '#6366F1',
      glow: '#818CF8',
      background: '#EEF2FF',
      text: '#312E81',
      gradient: {
        enabled: true,
        colors: ['#4F46E5', '#6366F1', '#818CF8']
      }
    }
  },
  sunset: {
    mastered: {
      primary: '#DC2626',
      secondary: '#EF4444',
      glow: '#F87171',
      background: '#FEF2F2',
      text: '#7F1D1D',
      gradient: {
        enabled: true,
        colors: ['#DC2626', '#EF4444', '#F87171']
      }
    },
    due: {
      primary: '#DB2777',
      secondary: '#EC4899',
      glow: '#F472B6',
      background: '#FDF2F8',
      text: '#831843',
      gradient: {
        enabled: true,
        colors: ['#DB2777', '#EC4899', '#F472B6']
      }
    },
    locked: {
      primary: '#71717A',
      secondary: '#A1A1AA',
      glow: '#D4D4D8',
      background: '#F4F4F5',
      text: '#27272A',
      gradient: {
        enabled: true,
        colors: ['#71717A', '#A1A1AA', '#D4D4D8']
      }
    },
    new: {
      primary: '#E11D48',
      secondary: '#F43F5E',
      glow: '#FB7185',
      background: '#FFF1F2',
      text: '#881337',
      gradient: {
        enabled: true,
        colors: ['#E11D48', '#F43F5E', '#FB7185']
      }
    },
    learning: {
      primary: '#9333EA',
      secondary: '#A855F7',
      glow: '#C084FC',
      background: '#FAF5FF',
      text: '#581C87',
      gradient: {
        enabled: true,
        colors: ['#9333EA', '#A855F7', '#C084FC']
      }
    }
  },
  forest: {
    mastered: {
      primary: '#166534',
      secondary: '#22C55E',
      glow: '#4ADE80',
      background: '#F0FDF4',
      text: '#14532D',
      gradient: {
        enabled: true,
        colors: ['#166534', '#22C55E', '#4ADE80']
      }
    },
    due: {
      primary: '#B45309',
      secondary: '#F59E0B',
      glow: '#FBBF24',
      background: '#FEF3C7',
      text: '#78350F',
      gradient: {
        enabled: true,
        colors: ['#B45309', '#F59E0B', '#FBBF24']
      }
    },
    locked: {
      primary: '#365314',
      secondary: '#65A30D',
      glow: '#84CC16',
      background: '#F7FEE7',
      text: '#1A2E05',
      gradient: {
        enabled: true,
        colors: ['#365314', '#65A30D', '#84CC16']
      }
    },
    new: {
      primary: '#15803D',
      secondary: '#16A34A',
      glow: '#22C55E',
      background: '#F0FDF4',
      text: '#14532D',
      gradient: {
        enabled: true,
        colors: ['#15803D', '#16A34A', '#22C55E']
      }
    },
    learning: {
      primary: '#0D9488',
      secondary: '#14B8A6',
      glow: '#2DD4BF',
      background: '#F0FDFA',
      text: '#134E4A',
      gradient: {
        enabled: true,
        colors: ['#0D9488', '#14B8A6', '#2DD4BF']
      }
    }
  },
  custom: LEARNING_STATUS_COLORS
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

export const getStatusColors = (status: LearningStatus, isDark: boolean = false, colorScheme: ColorScheme = 'default'): ColorConfig => {
  const schemeColors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default;
  const colors = schemeColors[status];
  
  if (isDark) {
    return {
      ...colors,
      background: adjustColorForDarkMode(colors.background),
      text: adjustColorForDarkMode(colors.text)
    };
  }
  
  return colors;
};

export const getColorScheme = (scheme: ColorScheme): Record<LearningStatus, ColorConfig> => {
  return COLOR_SCHEMES[scheme] || COLOR_SCHEMES.default;
};

export const getColorSchemeNames = (): { key: ColorScheme; name: string }[] => {
  return [
    { key: 'default', name: '默认' },
    { key: 'nature', name: '自然' },
    { key: 'ocean', name: '海洋' },
    { key: 'sunset', name: '日落' },
    { key: 'forest', name: '森林' },
    { key: 'custom', name: '自定义' }
  ];
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