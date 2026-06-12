import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteNoise } from "../../hooks/useWhiteNoise";
import { useFullscreen } from "../../hooks/useFullscreen";
import { useTimerStore } from "../../store/useTimerStore";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { AudioVisualizer } from "../common/AudioVisualizer";
import { FocusModeNoisePanel } from "./FocusModeNoisePanel";
import { FocusModeTopBar } from "./FocusModeTopBar";

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  taskTitle?: string;
  onFocusComplete?: () => void;
  children?: React.ReactNode;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onFocusComplete: _onFocusComplete,
  children,
}) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [showControls, setShowControls] = useState(true);
  const [showNoiseSelector, setShowNoiseSelector] = useState(false);
  const isActive = useTimerStore((s) => s.isActive);
  const { isPlaying, analyserData, startMixer, stopMixer } = useWhiteNoise();

  useEffect(() => {
    if (isOpen) {
      startMixer();
      if (taskId && !isActive) useTimerStore.getState().start(taskId, 25);
      frontendEventBus.publish("focus_enter", { taskId });
    } else {
      stopMixer();
      frontendEventBus.publish("focus_exit", {});
    }
  }, [isOpen, startMixer, stopMixer, taskId, isActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          onMouseMove={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <motion.div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.3) 0%, transparent 50%)`,
            }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <FocusModeTopBar
            showControls={showControls}
            taskTitle={taskTitle}
            taskId={taskId}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onClose={onClose}
          />

          <div className="absolute inset-0 flex items-center justify-center">
            {children}
          </div>

          {isPlaying && analyserData && (
            <AudioVisualizer
              analyserData={analyserData}
              type="wave"
              width={400}
              height={80}
              color="rgba(6, 182, 212, 0.5)"
              className="absolute bottom-24 left-1/2 -translate-x-1/2 opacity-50"
            />
          )}

          {/* Bottom noise panel */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent"
              >
                <FocusModeNoisePanel
                  showNoiseSelector={showNoiseSelector}
                  onToggleNoiseSelector={() =>
                    setShowNoiseSelector(!showNoiseSelector)
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Decorative rotating ring */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 rounded-full border border-primary-500/10" />
            <div className="absolute inset-4 rounded-full border border-primary-500/5" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
