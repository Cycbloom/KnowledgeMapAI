import React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { asyncConfirm } from "../../../utils/asyncConfirm";
import type { StoryCharacter } from "../../../services/api/storyCreation";

interface CharacterPanelProps {
  characters: StoryCharacter[];
  selectedId: string | null;
  onSelect: (character: StoryCharacter) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const ROLE_TYPE_COLORS: Record<StoryCharacter["role_type"], {
  bg: string;
  text: string;
  border: string;
  labelKey: string;
}> = {
  protagonist: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
    labelKey: "storyEditor.roleTypes.protagonist",
  },
  antagonist: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
    labelKey: "storyEditor.roleTypes.antagonist",
  },
  supporting: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
    labelKey: "storyEditor.roleTypes.supporting",
  },
  minor: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-300 dark:border-gray-600",
    labelKey: "storyEditor.roleTypes.minor",
  },
};

const DEFAULT_ROLE_CONFIG = {
  bg: "bg-gray-100 dark:bg-gray-800",
  text: "text-gray-600 dark:text-gray-400",
  border: "border-gray-300 dark:border-gray-600",
  labelKey: "storyEditor.roleTypes.minor",
};

export const CharacterPanel: React.FC<CharacterPanelProps> = ({
  characters,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}) => {
  const { t } = useTranslation();

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (await asyncConfirm({ title: t('common.confirm.deleteTitle'), message: t("storyEditor.confirmDelete"), isDangerous: true })) {
      onDelete(id);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Users size={14} />
          {t("storyEditor.characters", { count: characters.length })}
        </h3>
        <button
          onClick={onAdd}
          className="p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
          title={t("storyEditor.addCharacter")}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {characters.length === 0 ? (
          /* Empty State */
          <div className="px-3 py-6 text-center">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("storyEditor.noCharacters")}
            </p>
          </div>
        ) : (
          /* Character List */
          <div className="space-y-1 px-2">
            {characters.map(character => {
              const isSelected = selectedId === character.id;
              const roleConfig = ROLE_TYPE_COLORS[character.role_type] ?? DEFAULT_ROLE_CONFIG;

              return (
                <div
                  key={character.id}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors
                    ${isSelected
                      ? "bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500"
                      : "hover:bg-gray-100 dark:hover:bg-slate-700"
                    }`}
                  onClick={() => onSelect(character)}
                >
                  {/* Avatar with Initials */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm
                      ${roleConfig.bg} ${roleConfig.text}`}
                  >
                    {getInitials(character.name)}
                  </div>

                  {/* Name and Role Type */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      isSelected
                        ? "text-primary-700 dark:text-primary-300"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {character.name}
                    </div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5
                      ${roleConfig.bg} ${roleConfig.text}`}>
                      {t(roleConfig.labelKey as never)}
                    </span>
                  </div>

                  {/* Delete Button - Show on Hover */}
                  <button
                    onClick={(e) => handleDelete(e, character.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t("storyEditor.delete")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterPanel;
