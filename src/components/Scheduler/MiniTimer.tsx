import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Check, Maximize2, X, GripVertical } from 'lucide-react';
import { formatTimeFromSeconds } from '../../utils/formatters';
import { QUEUE_COLORS, type QueueLevel } from '@/constants/scheduler';

interface MiniTimerProps {
  taskTitle: string;
  duration: number;
  elapsed: number;
  isRunning: boolean;
  isBreak?: boolean;
  queueLevel?: number;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
}

export const MiniTimer: React.FC<MiniTimerProps> = ({
  taskTitle,
  duration,
  elapsed,
  isRunning,
  isBreak = false,
  queueLevel = 0,
  onPause,
  onResume,
  onComplete,
  onExpand,
  onClose,
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const remaining = Math.max(0, duration - elapsed);
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const queueColor = QUEUE_COLORS[queueLevel as QueueLevel] || QUEUE_COLORS[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 280, dragRef.current.startPosX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPosY + deltaY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
      className={`
        select-none
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      <div
        onMouseDown={handleMouseDown}
        className={`
          w-64 rounded-2xl overflow-hidden
          bg-gradient-to-r ${isBreak ? 'from-emerald-500 to-teal-500' : queueColor.gradient}
          shadow-2xl shadow-black/30
          backdrop-blur-sm
        `}
      >
        <div className="bg-black/20 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/80">
            <GripVertical size={14} />
            <span className="text-xs font-medium truncate max-w-[140px]">
              {isBreak ? '休息时间' : taskTitle}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onExpand}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/20 transition-colors text-white/80 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-3 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-2xl font-mono font-bold">
              {formatTimeFromSeconds(remaining)}
            </div>
            <div className="flex items-center gap-1">
              {isRunning ? (
                <button
                  onClick={onPause}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Pause size={18} />
                </button>
              ) : (
                <button
                  onClick={onResume}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Play size={18} />
                </button>
              )}
              <button
                onClick={onComplete}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
              >
                <Check size={18} />
              </button>
            </div>
          </div>

          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="text-xs text-white/60 mt-1 text-right">
            {Math.round(progress * 100)}%
          </div>
        </div>
      </div>
    </motion.div>
  );
};
