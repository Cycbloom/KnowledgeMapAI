import React from "react";
import {
  BookOpen,
  FileText,
  Microscope,
  Lightbulb,
  Target,
  Rocket,
} from "lucide-react";
import { BackboneModule } from "@shared/types/graph";
import {
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";

type IconSize = "small" | "medium" | "large";

interface BackboneNodeIconProps {
  module: BackboneModule;
  size?: IconSize;
  showTooltip?: boolean;
  className?: string;
}

const sizeMap: Record<IconSize, number> = {
  small: 14,
  medium: 18,
  large: 24,
};

const iconMap: Record<BackboneModule, React.ElementType> = {
  [BackboneModule.RESEARCH_BACKGROUND]: BookOpen,
  [BackboneModule.LITERATURE_REVIEW]: FileText,
  [BackboneModule.RESEARCH_METHODS]: Microscope,
  [BackboneModule.CORE_CONCEPTS]: Lightbulb,
  [BackboneModule.APPLICATION_DOMAINS]: Target,
  [BackboneModule.FUTURE_DIRECTIONS]: Rocket,
};

export const BackboneNodeIcon: React.FC<BackboneNodeIconProps> = ({
  module,
  size = "medium",
  showTooltip = true,
  className = "",
}) => {
  const Icon = iconMap[module];
  const iconSize = sizeMap[size];
  const color = BACKBONE_MODULE_COLORS[module];
  const label = BACKBONE_MODULE_LABELS[module];

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      title={showTooltip ? label : undefined}
    >
      <Icon size={iconSize} style={{ color }} aria-label={label} />
    </div>
  );
};
