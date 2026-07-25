import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  analyserData: Uint8Array | null;
  width?: number;
  height?: number;
  color?: string;
  type?: 'wave' | 'bars' | 'circle';
  className?: string;
}

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 100;

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyserData,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  color,
  type = 'wave',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const audioState: 'playing' | 'paused' | 'idle' =
    !analyserData || analyserData.length === 0 ? 'idle' : 'playing';
  const ariaLabel = t('common.audioVisualizer.ariaLabel', {
    state: t(`common.audioVisualizer.state.${audioState}`),
  });

  const defaultColor = useMemo(() => {
    return isDark ? '#60A5FA' : '#3B82F6';
  }, [isDark]);

  const visualColor = color || defaultColor;

  const drawWave = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array) => {
      const canvasWidth = ctx.canvas.width;
      const canvasHeight = ctx.canvas.height;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
      gradient.addColorStop(0, visualColor);
      gradient.addColorStop(0.5, `${visualColor}CC`);
      gradient.addColorStop(1, visualColor);

      ctx.beginPath();
      const sliceWidth = canvasWidth / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvasHeight) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = x - sliceWidth;
          const prevY = (data[i - 1] / 128.0) * canvasHeight / 2;
          const cpX = prevX + sliceWidth / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvasWidth, canvasHeight / 2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.lineTo(canvasWidth, canvasHeight);
      ctx.lineTo(0, canvasHeight);
      ctx.closePath();

      const fillGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      fillGradient.addColorStop(0, `${visualColor}40`);
      fillGradient.addColorStop(1, `${visualColor}05`);
      ctx.fillStyle = fillGradient;
      ctx.fill();
    },
    [visualColor]
  );

  const drawBars = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array) => {
      const canvasWidth = ctx.canvas.width;
      const canvasHeight = ctx.canvas.height;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const barCount = Math.min(data.length, 64);
      const barWidth = (canvasWidth / barCount) * 0.8;
      const gap = (canvasWidth / barCount) * 0.2;
      const step = Math.floor(data.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        const value = data[dataIndex] || 0;
        const barHeight = (value / 255) * canvasHeight * 0.9;

        const x = i * (barWidth + gap) + gap / 2;
        const y = canvasHeight - barHeight;

        const gradient = ctx.createLinearGradient(0, canvasHeight, 0, y);
        gradient.addColorStop(0, visualColor);
        gradient.addColorStop(0.5, `${visualColor}AA`);
        gradient.addColorStop(1, `${visualColor}60`);

        ctx.fillStyle = gradient;

        const radius = Math.min(barWidth / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, canvasHeight);
        ctx.lineTo(x, canvasHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = visualColor;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.shadowBlur = 0;
    },
    [visualColor]
  );

  const drawCircle = useCallback(
    (ctx: CanvasRenderingContext2D, data: Uint8Array) => {
      const canvasWidth = ctx.canvas.width;
      const canvasHeight = ctx.canvas.height;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const baseRadius = Math.min(canvasWidth, canvasHeight) / 4;
      const maxAmplitude = baseRadius * 0.8;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.5,
        centerX,
        centerY,
        baseRadius + maxAmplitude
      );
      gradient.addColorStop(0, `${visualColor}20`);
      gradient.addColorStop(0.5, `${visualColor}40`);
      gradient.addColorStop(1, `${visualColor}10`);

      ctx.beginPath();
      for (let i = 0; i <= data.length; i++) {
        const index = i % data.length;
        const angle = (index / data.length) * Math.PI * 2 - Math.PI / 2;
        const amplitude = (data[index] / 255) * maxAmplitude;
        const r = baseRadius + amplitude;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = visualColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `${visualColor}30`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = visualColor;
      ctx.fill();
    },
    [visualColor]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!analyserData || analyserData.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (type === 'wave') {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = `${visualColor}30`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (type === 'circle') {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = Math.min(canvas.width, canvas.height) / 4;

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${visualColor}30`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      return;
    }

    switch (type) {
      case 'wave':
        drawWave(ctx, analyserData);
        break;
      case 'bars':
        drawBars(ctx, analyserData);
        break;
      case 'circle':
        drawCircle(ctx, analyserData);
        break;
    }
  }, [analyserData, type, drawWave, drawBars, drawCircle, visualColor]);

  useEffect(() => {
    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [draw]);

  const containerStyle = useMemo(
    () => ({
      width: `${width}px`,
      height: `${height}px`,
    }),
    [width, height]
  );

  const canvasStyle = useMemo(
    () => ({
      width: '100%',
      height: '100%',
      borderRadius: type === 'circle' ? '50%' : '12px',
    }),
    [type]
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn('relative overflow-hidden', className)}
      style={containerStyle}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-xl backdrop-blur-sm',
          isDark ? 'bg-slate-900/50' : 'bg-gray-50/50'
        )}
        style={{ borderRadius: type === 'circle' ? '50%' : '12px' }}
      />
      <canvas
        ref={canvasRef}
        width={width * 2}
        height={height * 2}
        style={canvasStyle}
        className="relative z-10"
        role="img"
        aria-label={ariaLabel}
      />
      <div className="sr-only">{ariaLabel}</div>
      {type === 'circle' && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-0"
          style={{
            background: `radial-gradient(circle, ${visualColor}10 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.div>
  );
};

export default AudioVisualizer;
