import React from "react";
import { motion } from "framer-motion";
import { Check, Layers } from "lucide-react";
import type { BackboneModulePreset } from "@shared/types/graph";

interface PresetCardProps {
  preset: BackboneModulePreset;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  selected,
  onClick,
  disabled = false,
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-all
        ${
          selected
            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md"
            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            ${selected ? "bg-primary-100 dark:bg-primary-800/40" : "bg-gray-100 dark:bg-slate-700"}
          `}
        >
          <Layers
            size={20}
            className={selected ? "text-primary-600 dark:text-primary-400" : "text-gray-600 dark:text-gray-400"}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {preset.name}
            </h3>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex-shrink-0"
              >
                <Check size={16} className="text-primary-600 dark:text-primary-400" />
              </motion.div>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {preset.description}
          </p>

          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full">
              {preset.modules.length} 个模块
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
};
