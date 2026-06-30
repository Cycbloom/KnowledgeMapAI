import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Eye,
  RefreshCw,
  FileCheck,
  Layers,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { StudyMode } from "@shared/types/scheduler";
import {
  STUDY_MODE_PRESETS,
} from "@shared/constants/studyModePresets";

export type StudyModeIconType = LucideIcon;

export function useStudyModeLogic() {
  const { t } = useTranslation();
  const [studyMode, setStudyMode] = useState<StudyMode>("mixed");
  const [isStudyModeDropdownOpen, setIsStudyModeDropdownOpen] = useState(false);

  const getStudyModeIcon = (mode: StudyMode): StudyModeIconType => {
    const iconMap: Record<StudyMode, StudyModeIconType> = {
      drill: Zap,
      deep: BookOpen,
      preview: Eye,
      review: RefreshCw,
      quiz: FileCheck,
      mixed: Layers,
    };
    return iconMap[mode];
  };

  const shouldShowArticle = (): boolean => {
    const stages = STUDY_MODE_PRESETS[studyMode]?.workflow.stages ?? [];
    return stages.includes("learn");
  };

  const shouldShowQuiz = (): boolean => {
    const stages = STUDY_MODE_PRESETS[studyMode]?.workflow.stages ?? [];
    return stages.includes("quiz") || stages.includes("practice");
  };

  const getStrategyHint = (
    mode: StudyMode,
    nodeStatus:
      | { mastered: boolean; due?: boolean; review_count?: number }
      | undefined,
  ): string | null => {
    if (mode !== "mixed") return null;

    if (!nodeStatus) {
      return t("learning.studyMode.strategyHintNew");
    }
    if (!nodeStatus.mastered && (nodeStatus.review_count ?? 0) < 3) {
      return t("learning.studyMode.strategyHintLow");
    }
    if (nodeStatus.mastered) {
      return t("learning.studyMode.strategyHintHigh");
    }
    return t("learning.studyMode.strategyHintMedium");
  };

  const handleStudyModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
    setIsStudyModeDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setIsStudyModeDropdownOpen(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return {
    studyMode,
    setStudyMode,
    isStudyModeDropdownOpen,
    setIsStudyModeDropdownOpen,
    getStudyModeIcon,
    shouldShowArticle,
    shouldShowQuiz,
    getStrategyHint,
    handleStudyModeChange,
  };
}
