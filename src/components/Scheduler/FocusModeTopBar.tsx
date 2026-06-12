import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, Minimize2, Maximize2 } from "lucide-react";
import { useTimerStore } from "../../store/useTimerStore";

interface FocusModeTopBarProps {
  showControls: boolean;
  taskTitle?: string;
  taskId?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
}

export const FocusModeTopBar: React.FC<FocusModeTopBarProps> = ({
  showControls,
  taskTitle,
  taskId,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) => {
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const isActive = useTimerStore((s) => s.isActive);
  const progress = useTimerStore((s) => s.progress);

  return (
    <AnimatePresence>
      {showControls && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/20 border border-primary-500/30">
              <Shield size={16} className="text-primary-400" />
              <span className="text-sm text-primary-300">专注模式已开启</span>
            </div>
            {taskTitle && (
              <span className="text-slate-400 text-sm">| {taskTitle}</span>
            )}
            {isActive && taskId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600/30">
                <span className="text-xs text-slate-300 font-mono">
                  {Math.floor(timeLeft / 60).toString().padStart(2, "0")}
                  :{(timeLeft % 60).toString().padStart(2, "0")}
                </span>
                <div className="w-16 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-400 rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  {Math.round(progress)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onToggleFullscreen}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </motion.button>
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 text-white transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
