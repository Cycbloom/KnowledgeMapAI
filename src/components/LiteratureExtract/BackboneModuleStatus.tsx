import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle } from "lucide-react";
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";

export interface BackboneModuleStatusProps {
  module: BackboneModule;
  conceptCount: number;
  isRefined?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showCount?: boolean;
  className?: string;
}

export const BackboneModuleStatus: React.FC<BackboneModuleStatusProps> = ({
  module,
  conceptCount,
  isRefined = false,
  size = "md",
  showLabel = true,
  showCount = true,
  className = "",
}) => {
  const { t } = useTranslation();

  const moduleLabel = BACKBONE_MODULE_LABELS[module];
  const moduleColor = BACKBONE_MODULE_COLORS[module];

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const statusIcon = isRefined ? (
    <CheckCircle2
      size={iconSizes[size]}
      className="text-green-500 dark:text-green-400"
    />
  ) : (
    <Circle
      size={iconSizes[size]}
      className="text-gray-400 dark:text-gray-500"
    />
  );

  const statusText = isRefined
    ? t("literatureExtract.backboneModule.refined", "已完善")
    : t("literatureExtract.backboneModule.pending", "待完善");

  const countText = t("literatureExtract.backboneModule.conceptCount", {
    count: conceptCount,
    defaultValue: "{{count}} 个概念",
  });

  return (
    <div
      className={`
        inline-flex items-center rounded-lg border
        bg-white dark:bg-gray-800
        border-gray-200 dark:border-gray-700
        ${sizeClasses[size]}
        ${className}
      `}
      style={{
        borderLeftColor: moduleColor,
        borderLeftWidth: "3px",
      }}
    >
      {statusIcon}

      {showLabel && (
        <span className="font-medium" style={{ color: moduleColor }}>
          {moduleLabel}
        </span>
      )}

      <span className="text-gray-500 dark:text-gray-400 text-xs">
        {statusText}
      </span>

      {showCount && conceptCount > 0 && (
        <span className="text-gray-400 dark:text-gray-500 text-xs">
          · {countText}
        </span>
      )}
    </div>
  );
};

export default BackboneModuleStatus;
