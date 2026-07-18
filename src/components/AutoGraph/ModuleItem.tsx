import React from "react";
import { Trash2 } from "lucide-react";
import type { BackboneModuleCustomConfig } from "@shared/types/graph";
import { ColorPicker } from "./ColorPicker";
import { IconPicker } from "./IconPicker";

interface ModuleItemProps {
  module: BackboneModuleCustomConfig;
  index: number;
  onChange: (module: BackboneModuleCustomConfig) => void;
  onDelete: () => void;
  canDelete: boolean;
  disabled?: boolean;
}

const ModuleItemComponent: React.FC<ModuleItemProps> = ({
  module,
  index,
  onChange,
  onDelete,
  canDelete,
  disabled = false,
}) => {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 20);
    onChange({ ...module, title: value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 100);
    onChange({ ...module, description: value });
  };

  const handleIconChange = (icon: string) => {
    onChange({ ...module, icon });
  };

  const handleColorChange = (color: string) => {
    onChange({ ...module, color });
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              #{index + 1}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {module.title.length}/20
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="text"
              value={module.title}
              onChange={handleTitleChange}
              disabled={disabled}
              maxLength={20}
              placeholder="模块名称"
              className={`
                w-full px-2 py-1.5 text-xs border rounded-md transition-colors
                bg-white dark:bg-slate-700
                border-gray-200 dark:border-gray-600
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:ring-1 focus:ring-primary-500 focus:border-transparent
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />
            <div className="flex items-center gap-1">
              <IconPicker
                value={module.icon}
                onChange={handleIconChange}
                disabled={disabled}
              />
              <ColorPicker
                value={module.color}
                onChange={handleColorChange}
                disabled={disabled}
              />
            </div>
          </div>

          <input
            type="text"
            value={module.description}
            onChange={handleDescriptionChange}
            disabled={disabled}
            maxLength={100}
            placeholder="模块描述（可选）"
            className={`
              w-full px-2 py-1.5 text-xs border rounded-md transition-colors
              bg-white dark:bg-slate-700
              border-gray-200 dark:border-gray-600
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:ring-1 focus:ring-primary-500 focus:border-transparent
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            `}
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete || disabled}
          className={`
            flex-shrink-0 p-1.5 rounded-md transition-colors
            ${
              canDelete && !disabled
                ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                : "text-gray-300 dark:text-gray-600 cursor-not-allowed"
            }
          `}
          aria-label={canDelete ? "删除模块" : "至少保留 3 个模块"}
          title={canDelete ? "删除模块" : "至少保留 3 个模块"}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export const ModuleItem = React.memo(ModuleItemComponent);
