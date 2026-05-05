import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, Settings, Play, Lightbulb, Cpu, Hammer } from 'lucide-react';
import { useTheme } from '../../hooks';
import {
  ConceptType,
  CONCEPT_TYPE_COLORS,
  CONCEPT_TYPE_LABELS,
} from '../../../shared/types/graph';

interface ConceptTypeBadgeProps {
  type: ConceptType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const CONCEPT_TYPE_ICONS: Record<ConceptType, React.ElementType> = {
  method: Wrench,
  mechanism: Settings,
  operation: Play,
  concept: Lightbulb,
  technology: Cpu,
  tool: Hammer,
};

const SIZE_CONFIG = {
  sm: {
    container: 'px-2 py-0.5 text-xs gap-1',
    icon: 12,
  },
  md: {
    container: 'px-2.5 py-1 text-sm gap-1.5',
    icon: 14,
  },
  lg: {
    container: 'px-3 py-1.5 text-base gap-2',
    icon: 16,
  },
};

const getTailwindClasses = (color: string, isDark: boolean): string => {
  const colorMap: Record<string, { bg: string; bgDark: string; text: string; textDark: string }> = {
    '#3B82F6': {
      bg: 'bg-blue-100',
      bgDark: 'dark:bg-blue-900/30',
      text: 'text-blue-700',
      textDark: 'dark:text-blue-300',
    },
    '#10B981': {
      bg: 'bg-emerald-100',
      bgDark: 'dark:bg-emerald-900/30',
      text: 'text-emerald-700',
      textDark: 'dark:text-emerald-300',
    },
    '#F59E0B': {
      bg: 'bg-amber-100',
      bgDark: 'dark:bg-amber-900/30',
      text: 'text-amber-700',
      textDark: 'dark:text-amber-300',
    },
    '#8B5CF6': {
      bg: 'bg-violet-100',
      bgDark: 'dark:bg-violet-900/30',
      text: 'text-violet-700',
      textDark: 'dark:text-violet-300',
    },
    '#EC4899': {
      bg: 'bg-pink-100',
      bgDark: 'dark:bg-pink-900/30',
      text: 'text-pink-700',
      textDark: 'dark:text-pink-300',
    },
    '#6366F1': {
      bg: 'bg-indigo-100',
      bgDark: 'dark:bg-indigo-900/30',
      text: 'text-indigo-700',
      textDark: 'dark:text-indigo-300',
    },
  };

  const classes = colorMap[color];
  if (!classes) {
    return isDark
      ? 'bg-gray-700 text-gray-300'
      : 'bg-gray-100 text-gray-700';
  }

  return `${classes.bg} ${classes.bgDark} ${classes.text} ${classes.textDark}`;
};

export const ConceptTypeBadge: React.FC<ConceptTypeBadgeProps> = ({
  type,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className = '',
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const color = CONCEPT_TYPE_COLORS[type];
  const label = CONCEPT_TYPE_LABELS[type];
  const Icon = CONCEPT_TYPE_ICONS[type];
  const sizeConfig = SIZE_CONFIG[size];

  const colorClasses = getTailwindClasses(color, isDark);

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${sizeConfig.container}
        ${colorClasses}
        ${className}
      `}
      title={t(`conceptTypes.${type}`, label)}
    >
      {showIcon && Icon && (
        <Icon size={sizeConfig.icon} aria-hidden="true" />
      )}
      {showLabel && (
        <span>{t(`conceptTypes.${type}`, label)}</span>
      )}
    </span>
  );
};

export const ConceptTypeIcon: React.FC<{
  type: ConceptType;
  size?: number;
  className?: string;
}> = ({ type, size = 16, className = '' }) => {
  const color = CONCEPT_TYPE_COLORS[type];
  const Icon = CONCEPT_TYPE_ICONS[type];

  if (!Icon) return null;

  return (
    <Icon
      size={size}
      style={{ color }}
      className={className}
      aria-hidden="true"
    />
  );
};

export const ConceptTypeDot: React.FC<{
  type: ConceptType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ type, size = 'md', className = '' }) => {
  const color = CONCEPT_TYPE_COLORS[type];

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`inline-block rounded-full ${dotSize[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
};

export default ConceptTypeBadge;
