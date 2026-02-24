import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Play, Pause, MonitorPlay } from 'lucide-react';

interface PresentationControlsProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onExit,
  isPlaying = false,
  onTogglePlay
}) => {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Space') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onExit]);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4 z-50 transition-all duration-300 animate-in slide-in-from-bottom-10 fade-in">
      <div className="flex items-center gap-2 mr-2">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
          <MonitorPlay size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">演示模式</span>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
      </div>

      <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentStep === 0}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
          title="上一步 (←)"
        >
          <ChevronLeft size={24} />
        </button>

        {onTogglePlay && (
          <button
            onClick={onTogglePlay}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-md mx-1"
            title={isPlaying ? "暂停" : "自动播放"}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
        )}

        <button
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
          title="下一步 (→)"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />

      <button
        onClick={onExit}
        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full transition-colors"
        title="退出演示 (Esc)"
      >
        <X size={20} />
      </button>
    </div>
  );
};
