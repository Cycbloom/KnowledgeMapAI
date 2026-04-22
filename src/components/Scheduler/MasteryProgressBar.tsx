import React from "react";
import { motion } from "framer-motion";

interface MasteryProgressBarProps {
  masteryLevel: number;
  showLabel?: boolean;
  animated?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CONFIGS = {
  sm: {
    height: "h-1",
    text: "text-[10px]",
    container: "gap-1",
  },
  md: {
    height: "h-2",
    text: "text-xs",
    container: "gap-2",
  },
  lg: {
    height: "h-3",
    text: "text-sm",
    container: "gap-2",
  },
};

const getMasteryColor = (
  level: number,
): { bg: string; text: string; progress: string } => {
  if (level < 30) {
    return {
      bg: "bg-red-100 dark:bg-red-500/20",
      text: "text-red-600 dark:text-red-400",
      progress: "bg-red-500",
    };
  }
  if (level < 70) {
    return {
      bg: "bg-orange-100 dark:bg-orange-500/20",
      text: "text-orange-600 dark:text-orange-400",
      progress: "bg-orange-500",
    };
  }
  return {
    bg: "bg-green-100 dark:bg-green-500/20",
    text: "text-green-600 dark:text-green-400",
    progress: "bg-green-500",
  };
};

const getMasteryLabel = (level: number): string => {
  if (level < 30) return "需要复习";
  if (level < 70) return "学习中";
  return "掌握良好";
};

export const MasteryProgressBar: React.FC<MasteryProgressBarProps> = ({
  masteryLevel,
  showLabel = true,
  animated = true,
  size = "md",
  className = "",
}) => {
  const clampedLevel = Math.min(100, Math.max(0, masteryLevel));
  const colors = getMasteryColor(clampedLevel);
  const sizeConfig = SIZE_CONFIGS[size];

  const ProgressComponent = animated ? motion.div : "div";
  const progressProps = animated
    ? {
        initial: { width: 0 },
        animate: { width: `${clampedLevel}%` },
        transition: { duration: 0.5, ease: "easeOut" },
      }
    : { style: { width: `${clampedLevel}%` } };

  return (
    <div className={`flex items-center ${sizeConfig.container} ${className}`}>
      <div
        className={`
          flex-1 rounded-full overflow-hidden
          ${sizeConfig.height} ${colors.bg}
        `}
      >
        <ProgressComponent
          className={`h-full rounded-full ${colors.progress}`}
          {...progressProps}
        />
      </div>
      {showLabel && (
        <div
          className={`flex items-center gap-1 ${sizeConfig.text} ${colors.text} whitespace-nowrap`}
        >
          <span className="font-medium">{clampedLevel}%</span>
          <span className="hidden sm:inline opacity-70">
            ({getMasteryLabel(clampedLevel)})
          </span>
        </div>
      )}
    </div>
  );
};

export default MasteryProgressBar;
