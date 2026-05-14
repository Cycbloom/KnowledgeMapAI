import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Sparkles } from "lucide-react";
import type {
  BackboneModulePreset,
  BackboneModuleCustomConfig,
} from "@shared/types/graph";
import {
  ACADEMIC_RESEARCH,
  EXPERIMENTAL_SCIENCE,
  ENGINEERING_RESEARCH,
  POLICY_RESEARCH,
} from "@shared/constants/backboneModulePresets";
import { PresetCard } from "./PresetCard";
import { CustomModuleEditor } from "./CustomModuleEditor";
import { useTheme } from "@/hooks";

interface BackboneModuleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: {
    presetId: string | null;
    customModules?: BackboneModuleCustomConfig[];
  }) => void;
  initialPresetId?: string | null;
  initialCustomModules?: BackboneModuleCustomConfig[];
}

const PRESETS: BackboneModulePreset[] = [
  ACADEMIC_RESEARCH,
  EXPERIMENTAL_SCIENCE,
  ENGINEERING_RESEARCH,
  POLICY_RESEARCH,
];

const DEFAULT_PRESET_ID = ACADEMIC_RESEARCH.id;

const createDefaultCustomModules = (): BackboneModuleCustomConfig[] => {
  return ACADEMIC_RESEARCH.modules.map((m: BackboneModuleCustomConfig) => ({
    module_type: m.module_type,
    title: m.title,
    icon: m.icon,
    color: m.color,
    description: m.description,
    suggestedNodes: m.suggestedNodes,
    relationshipToCore: m.relationshipToCore,
  }));
};

export const BackboneModuleSelector: React.FC<BackboneModuleSelectorProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialPresetId,
  initialCustomModules,
}) => {
  const { isDark } = useTheme();
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    initialPresetId || DEFAULT_PRESET_ID,
  );
  const [showCustomEditor, setShowCustomEditor] = useState(
    initialPresetId === null || initialPresetId === "custom",
  );
  const [customModules, setCustomModules] = useState<
    BackboneModuleCustomConfig[]
  >(
    initialCustomModules && initialCustomModules.length > 0
      ? initialCustomModules
      : createDefaultCustomModules(),
  );

  const handlePresetClick = (presetId: string) => {
    setSelectedPresetId(presetId);
    setShowCustomEditor(false);
  };

  const handleCustomClick = () => {
    setSelectedPresetId(null);
    setShowCustomEditor(true);
  };

  const handleConfirm = () => {
    if (showCustomEditor) {
      onConfirm({
        presetId: null,
        customModules,
      });
    } else {
      onConfirm({
        presetId: selectedPresetId,
      });
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const selectedPreset = useMemo(
    () => PRESETS.find((p) => p.id === selectedPresetId),
    [selectedPresetId],
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleCancel}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`
            relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden
            ${isDark ? "bg-slate-900" : "bg-white"}
          `}
        >
          <div
            className={`
              flex items-center justify-between px-6 py-4 border-b
              ${isDark ? "border-slate-700" : "border-gray-200"}
            `}
          >
            <div className="flex items-center gap-3">
              <div
                className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  ${isDark ? "bg-primary-900/30" : "bg-primary-50"}
                `}
              >
                <Sparkles
                  size={20}
                  className={isDark ? "text-primary-400" : "text-primary-600"}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  选择模块配置
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  选择预设配置或自定义模块结构
                </p>
              </div>
            </div>

            <button
              onClick={handleCancel}
              className={`
                p-2 rounded-lg transition-colors
                ${isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"}
              `}
            >
              <X
                size={20}
                className={isDark ? "text-gray-400" : "text-gray-500"}
              />
            </button>
          </div>

          <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                预设配置
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={
                      selectedPresetId === preset.id && !showCustomEditor
                    }
                    onClick={() => handlePresetClick(preset.id)}
                  />
                ))}
                <button
                  onClick={handleCustomClick}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all
                    ${
                      showCustomEditor
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600"
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                        flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                        ${showCustomEditor ? "bg-primary-100 dark:bg-primary-800/40" : "bg-gray-100 dark:bg-slate-700"}
                      `}
                    >
                      <span
                        className={
                          showCustomEditor
                            ? "text-primary-600 dark:text-primary-400"
                            : "text-gray-600 dark:text-gray-400"
                        }
                      >
                        ✏️
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          自定义
                        </h3>
                        {showCustomEditor && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <Check
                              size={16}
                              className="text-primary-600 dark:text-primary-400"
                            />
                          </motion.div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        创建自定义模块结构，自由配置模块名称、颜色和图标
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                          3-10 个模块
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showCustomEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`
                      p-4 rounded-xl border
                      ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}
                    `}
                  >
                    <CustomModuleEditor
                      modules={customModules}
                      onChange={setCustomModules}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showCustomEditor && selectedPreset && (
              <div
                className={`
                  mt-6 p-4 rounded-xl border
                  ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"}
                `}
              >
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {selectedPreset.name} 模块预览
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPreset.modules.map((module, index) => (
                    <div
                      key={index}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                        ${isDark ? "bg-slate-700" : "bg-white"}
                      `}
                      style={{ borderLeft: `3px solid ${module.color}` }}
                    >
                      <span>{module.icon}</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {module.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className={`
              flex items-center justify-end gap-3 px-6 py-4 border-t
              ${isDark ? "border-slate-700" : "border-gray-200"}
            `}
          >
            <button
              onClick={handleCancel}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${isDark ? "hover:bg-slate-800 text-gray-300" : "hover:bg-gray-100 text-gray-700"}
              `}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className={`
                px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
                ${
                  isDark
                    ? "bg-primary-600 hover:bg-primary-500 text-white"
                    : "bg-primary-600 hover:bg-primary-700 text-white"
                }
              `}
            >
              <Check size={18} />
              确认配置
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BackboneModuleSelector;
