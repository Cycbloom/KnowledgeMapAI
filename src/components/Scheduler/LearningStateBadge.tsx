import React from "react";
import { BookOpen, RefreshCw, Pencil, FileCheck } from "lucide-react";
import { LearningState, LEARNING_STATE_CONFIGS } from "@shared/types";

interface LearningStateBadgeProps {
  state: LearningState;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const STATE_ICONS: Record<
  LearningState,
  React.ComponentType<{ size?: number | string }>
> = {
  learning: BookOpen,
  review: RefreshCw,
  practice: Pencil,
  quiz: FileCheck,
};

export const LearningStateBadge: React.FC<LearningStateBadgeProps> = ({
  state,
  size = "md",
  showIcon = true,
  className = "",
}) => {
  const config = LEARNING_STATE_CONFIGS[state];
  const Icon = STATE_ICONS[state];

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-2.5 py-1.5 text-sm",
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded font-medium border
        ${config.bgColor} ${config.color} ${config.borderColor}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {showIcon && Icon && <Icon size={iconSizes[size]} />}
      <span>{config.label}</span>
    </span>
  );
};
