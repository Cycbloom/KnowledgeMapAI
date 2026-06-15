import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PlaySpeed } from '../../../hooks/graphEditor/useNarrativeState';

interface NarrativeControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPlayNext: () => void;
  onPlayPrev: () => void;
  onReset: () => void;
  onExit: () => void;
  playSpeed: PlaySpeed;
  onSpeedChange: (speed: PlaySpeed) => void;
  currentStep: number;
  totalSteps: number;
  isNarrativeComplete: boolean;
  isDark?: boolean;
}

export const NarrativeControls: React.FC<NarrativeControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPlayNext,
  onPlayPrev,
  onReset,
  onExit,
  playSpeed,
  onSpeedChange,
  currentStep,
  totalSteps,
  isNarrativeComplete,
  isDark = false,
}) => {
  const { t } = useTranslation();

  const speeds: PlaySpeed[] = [0.5, 1, 2];

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(241, 245, 249, 0.9)',
    color: isDark ? '#E2E8F0' : '#334155',
    fontSize: 14,
    transition: 'background 0.2s',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderRadius: 12,
        background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 20,
      }}
    >
      {/* Exit button */}
      <button
        onClick={onExit}
        style={{ ...buttonStyle, width: 28, fontSize: 12 }}
        title={t('graphEditor.narrative.exit', '退出叙事')}
      >
        ✕
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        style={buttonStyle}
        title={t('graphEditor.narrative.reset', '重置')}
      >
        ⟲
      </button>

      {/* Previous */}
      <button
        onClick={onPlayPrev}
        disabled={currentStep <= 1}
        style={{ ...buttonStyle, opacity: currentStep <= 1 ? 0.4 : 1, cursor: currentStep <= 1 ? 'not-allowed' : 'pointer' }}
        title={t('graphEditor.narrative.prev', '上一步')}
      >
        ◀
      </button>

      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        style={{
          ...buttonStyle,
          width: 40,
          height: 40,
          borderRadius: 20,
          background: isNarrativeComplete
            ? '#10B981'
            : isDark ? '#3B82F6' : '#2563EB',
          color: 'white',
          fontSize: 16,
        }}
        title={isNarrativeComplete
          ? t('graphEditor.narrative.complete', '叙事完成')
          : isPlaying
            ? t('graphEditor.narrative.pause', '暂停')
            : t('graphEditor.narrative.play', '播放')
        }
      >
        {isNarrativeComplete ? '✓' : isPlaying ? '⏸' : '▶'}
      </button>

      {/* Next */}
      <button
        onClick={onPlayNext}
        disabled={currentStep >= totalSteps}
        style={{ ...buttonStyle, opacity: currentStep >= totalSteps ? 0.4 : 1, cursor: currentStep >= totalSteps ? 'not-allowed' : 'pointer' }}
        title={t('graphEditor.narrative.next', '下一步')}
      >
        ▶
      </button>

      {/* Progress */}
      <div style={{
        fontSize: 12,
        color: isDark ? '#94A3B8' : '#64748B',
        minWidth: 48,
        textAlign: 'center',
      }}>
        {currentStep}/{totalSteps}
      </div>

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: 2 }}>
        {speeds.map(speed => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            style={{
              ...buttonStyle,
              width: 28,
              height: 24,
              fontSize: 10,
              background: playSpeed === speed
                ? (isDark ? '#3B82F6' : '#2563EB')
                : (isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(241, 245, 249, 0.9)'),
              color: playSpeed === speed ? 'white' : (isDark ? '#94A3B8' : '#64748B'),
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Narrative complete message */}
      {isNarrativeComplete && (
        <span style={{
          fontSize: 12,
          color: '#10B981',
          fontWeight: 500,
        }}>
          {t('graphEditor.narrative.complete', '叙事完成')}
        </span>
      )}
    </div>
  );
};
