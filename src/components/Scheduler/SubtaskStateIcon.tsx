import React from "react";
import {
  BookOpen,
  RefreshCw,
  Pencil,
  FileCheck,
  LucideIcon,
} from "lucide-react";
import { LearningState, LEARNING_STATE_CONFIGS } from "@shared/types/scheduler";

interface SubtaskStateIconProps {
  state: LearningState;
  size?: number;
  className?: string;
}

const ICON_MAP: Record<LearningState, LucideIcon> = {
  learning: BookOpen,
  review: RefreshCw,
  practice: Pencil,
  quiz: FileCheck,
};

export const SubtaskStateIcon: React.FC<SubtaskStateIconProps> = ({
  state,
  size = 16,
  className = "",
}) => {
  const Icon = ICON_MAP[state];
  const config = LEARNING_STATE_CONFIGS[state];

  if (!Icon || !config) {
    return null;
  }

  return <Icon size={size} className={`${config.color} ${className}`} />;
};

export default SubtaskStateIcon;
