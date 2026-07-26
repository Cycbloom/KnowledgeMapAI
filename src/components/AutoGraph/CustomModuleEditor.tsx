import React, { useMemo } from "react";
import { Plus, AlertCircle } from "lucide-react";
import type { BackboneModuleCustomConfig } from "@shared/types/graph";
import { ModuleItem } from "./ModuleItem";

interface CustomModuleEditorProps {
  modules: BackboneModuleCustomConfig[];
  onChange: (modules: BackboneModuleCustomConfig[]) => void;
  disabled?: boolean;
}

const MIN_MODULES = 3;
const MAX_MODULES = 10;

const createEmptyModule = (defaultColor: string): BackboneModuleCustomConfig => ({
  module_type: "",
  title: "",
  icon: "📚",
  color: defaultColor,
  description: "",
  suggestedNodes: [],
  relationshipToCore: "",
});

const getThemePrimaryColor = (): string => {
  if (typeof window === "undefined") return "#3B82F6";
  const computedStyle = getComputedStyle(document.documentElement);
  const primaryColor = computedStyle.getPropertyValue("--primary-500").trim();
  return primaryColor || "#3B82F6";
};

export const CustomModuleEditor: React.FC<CustomModuleEditorProps> = ({
  modules,
  onChange,
  disabled = false,
}) => {
  const defaultModuleColor = useMemo(() => getThemePrimaryColor(), []);

  const handleModuleChange = (
    index: number,
    updatedModule: BackboneModuleCustomConfig,
  ) => {
    const newModules = [...modules];
    newModules[index] = updatedModule;
    onChange(newModules);
  };

  const handleDeleteModule = (index: number) => {
    if (modules.length > MIN_MODULES) {
      const newModules = modules.filter((_, i) => i !== index);
      onChange(newModules);
    }
  };

  const handleAddModule = () => {
    if (modules.length < MAX_MODULES) {
      const newModules = [...modules, createEmptyModule(defaultModuleColor)];
      onChange(newModules);
    }
  };

  const canAddMore = modules.length < MAX_MODULES;
  const canDeleteMore = modules.length > MIN_MODULES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {modules.length}/{MAX_MODULES} 个模块
        </span>
        {modules.length < MIN_MODULES && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle size={12} />
            <span>至少 {MIN_MODULES} 个</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {modules.map((module, index) => (
          <ModuleItem
            key={index}
            module={module}
            index={index}
            onChange={(updatedModule) =>
              handleModuleChange(index, updatedModule)
            }
            onDelete={() => handleDeleteModule(index)}
            canDelete={canDeleteMore}
            disabled={disabled}
          />
        ))}
      </div>

      {canAddMore && (
        <button
          type="button"
          onClick={handleAddModule}
          disabled={disabled}
          className={`
            w-full py-2 px-3 border-2 border-dashed rounded-lg
            flex items-center justify-center gap-1.5
            transition-colors text-xs font-medium
            ${
              disabled
                ? "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed"
                : "border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10"
            }
          `}
        >
          <Plus size={14} />
          <span>添加模块</span>
        </button>
      )}

      {!canAddMore && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-500 py-1">
          已达上限 ({MAX_MODULES})
        </p>
      )}
    </div>
  );
};
