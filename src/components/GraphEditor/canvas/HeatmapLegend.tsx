import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEATMAP_CONFIG, DECAY_CONFIG } from '../../../config/graphConfig';
import type { GraphColorMode } from '@shared/types/graph';

interface ColorModeLegendProps {
  coloringMode: GraphColorMode;
  isDark?: boolean;
}

export const ColorModeLegend: React.FC<ColorModeLegendProps> = ({ coloringMode, isDark = false }) => {
  const { t } = useTranslation();

  // Only show legend for heatmap and decay modes
  if (coloringMode !== 'heatmap' && coloringMode !== 'decay') {
    return null;
  }

  const config = coloringMode === 'heatmap' ? HEATMAP_CONFIG : DECAY_CONFIG;

  const gradientStops = config.colorStops
    .map((stop) => `${stop.color} ${stop.value * 100}%`)
    .join(', ');

  const lowLabel = coloringMode === 'heatmap'
    ? t('graphEditor.heatmap.low', '低活跃')
    : t('graphEditor.decay.decayed', '衰减');

  const highLabel = coloringMode === 'heatmap'
    ? t('graphEditor.heatmap.high', '高活跃')
    : t('graphEditor.decay.fresh', '牢固');

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        borderRadius: 8,
        background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(4px)',
        border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: 120,
          height: 10,
          borderRadius: 5,
          background: `linear-gradient(to right, ${gradientStops})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          fontSize: 10,
          color: isDark ? '#94A3B8' : '#64748B',
        }}
      >
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
};

// Keep backward compatibility alias
export const HeatmapLegend: React.FC<Omit<ColorModeLegendProps, 'coloringMode'> & { coloringMode?: GraphColorMode }> = (props) => {
  return <ColorModeLegend {...props} coloringMode={props.coloringMode ?? 'heatmap'} />;
};
