import React, { useState, useEffect, useRef } from "react";
import { Save, Loader2, FileText, MapPin, Clock, User, Type, CheckSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { storyCreationHttpApi, type StoryStructure, type StoryCharacter, type StorySceneDetail } from "../../../services/api/storyCreation";
import { message } from "../../../utils/messageHelper";
import { useFormDraft, useBeforeUnload } from "../../../hooks";
import { ConfirmationModal } from "../../common/ConfirmationModal";

interface SceneEditorProps {
  graphId: string;
  structure: StoryStructure;
  characters: StoryCharacter[];
  onSave: () => void;
}

type SceneRole = "protagonist" | "antagonist" | "supporting" | "minor" | "mentioned";

type WritingStatus = "draft" | "revising" | "complete";

interface SceneDraft {
  synopsis: string;
  content: string;
  povCharacterId: string;
  locationName: string;
  timeSetting: string;
  writingStatus: WritingStatus;
  // Map<string, { checked: boolean; role: SceneRole }> serialized as Record for draft storage
  appearances: Record<string, { checked: boolean; role: SceneRole }>;
}

const EMPTY_SCENE_DRAFT: SceneDraft = {
  synopsis: "",
  content: "",
  povCharacterId: "",
  locationName: "",
  timeSetting: "",
  writingStatus: "draft",
  appearances: {},
};

export const SceneEditor: React.FC<SceneEditorProps> = ({
  graphId,
  structure,
  characters,
  onSave,
}) => {
  const { t } = useTranslation();

  const [sceneData, setSceneData] = useState<StorySceneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<SceneDraft>({
    key: "scene_editor_draft",
    initialValue: EMPTY_SCENE_DRAFT,
  });

  // Track original appearances to detect changes for persistence
  const originalAppearancesRef = useRef<Map<string, { checked: boolean; role: SceneRole }>>(new Map());

  // Track the last loaded/saved form data to detect unsaved changes
  const lastSavedDataRef = useRef<SceneDraft>(EMPTY_SCENE_DRAFT);

  useEffect(() => {
    loadSceneData();
    // 仅在 structure.id 变化时重新加载场景；loadSceneData 闭包在触发时已是最新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure.id]);

  // Sync lastSavedDataRef when sceneData changes (after loadSceneData completes)
  useEffect(() => {
    lastSavedDataRef.current = sceneData ? { ...formData } : EMPTY_SCENE_DRAFT;
    // 仅在 sceneData 加载完成时同步基线；formData 此时已为新值，无需进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneData]);

  // Warn user before leaving when there are unsaved changes
  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(lastSavedDataRef.current);
  useBeforeUnload(isDirty, t("common.unsavedChanges"));

  const loadSceneData = async () => {
    try {
      setLoading(true);
      const result = await storyCreationHttpApi.scenes.get(graphId, structure.id);
      if (result.scene) {
        setSceneData(result.scene);

        const appearanceRecord: Record<string, { checked: boolean; role: SceneRole }> = {};
        if (result.scene.appearances) {
          result.scene.appearances.forEach((appearance: { character_id: string; role_in_scene: string }) => {
            appearanceRecord[appearance.character_id] = {
              checked: true,
              role: appearance.role_in_scene as SceneRole,
            };
          });
          originalAppearancesRef.current = new Map(Object.entries(appearanceRecord));
        } else {
          originalAppearancesRef.current = new Map();
        }

        setFormData({
          synopsis: result.scene.synopsis || "",
          content: result.scene.content || "",
          povCharacterId: result.scene.pov_character_id || "",
          locationName: result.scene.location_name || "",
          timeSetting: result.scene.time_setting || "",
          writingStatus: (result.scene.writing_status as WritingStatus) || "draft",
          appearances: appearanceRecord,
        });
      } else {
        // No scene data yet, reset form
        setSceneData(null);
        setFormData(EMPTY_SCENE_DRAFT);
        originalAppearancesRef.current = new Map();
      }
    } catch (error) {
      console.error("Failed to load scene data:", error);
      message.error(t("storyEditor.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      let currentSceneData = sceneData;

      // Save scene content
      if (currentSceneData) {
        await storyCreationHttpApi.scenes.update(graphId, currentSceneData.id, {
          synopsis: formData.synopsis,
          content: formData.content,
          pov_character_id: formData.povCharacterId || null,
          location_name: formData.locationName || null,
          time_setting: formData.timeSetting || null,
          writing_status: formData.writingStatus,
          word_count: formData.content.length,
        });
      } else {
        const newScene = await storyCreationHttpApi.scenes.create(graphId, {
          structure_id: structure.id,
          synopsis: formData.synopsis,
          content: formData.content,
          pov_character_id: formData.povCharacterId || undefined,
          location_name: formData.locationName || undefined,
          time_setting: formData.timeSetting || undefined,
          writing_status: formData.writingStatus,
          word_count: formData.content.length,
        });
        setSceneData(newScene);
        currentSceneData = newScene;
      }

      // Persist appearance changes
      if (currentSceneData) {
        const original = originalAppearancesRef.current;
        // Convert Record back to Map for diffing logic
        const current = new Map(Object.entries(formData.appearances));

        // Find newly added appearances (in current but not in original)
        const addedPromises: Promise<unknown>[] = [];
        const removedIds: string[] = [];

        current.forEach((value, characterId) => {
          if (!original.has(characterId)) {
            // New appearance - create it
            addedPromises.push(
              storyCreationHttpApi.appearances.create(graphId, {
                character_id: characterId,
                scene_detail_id: currentSceneData.id,
                role_in_scene: value.role,
              })
            );
          } else if (original.get(characterId)?.role !== value.role) {
            // Role changed - remove old and create new
            removedIds.push(characterId);
            addedPromises.push(
              storyCreationHttpApi.appearances.create(graphId, {
                character_id: characterId,
                scene_detail_id: currentSceneData.id,
                role_in_scene: value.role,
              })
            );
          }
        });

        // Find removed appearances (in original but not in current)
        original.forEach((_value, characterId) => {
          if (!current.has(characterId)) {
            removedIds.push(characterId);
          }
        });

        // Execute removals and additions
        if (removedIds.length > 0 || addedPromises.length > 0) {
          // For removals, we need to find the appearance IDs
          // Re-fetch appearances to get IDs for removal
          const result = await storyCreationHttpApi.scenes.get(graphId, structure.id);
          if (result.scene?.appearances) {
            const deletePromises = result.scene.appearances
              .filter((app: { character_id: string }) => removedIds.includes(app.character_id))
              .map((app: { id: string }) => storyCreationHttpApi.appearances.delete(graphId, app.id));

            await Promise.all([...deletePromises, ...addedPromises]);
          }
        }

        // Update original appearances ref
        originalAppearancesRef.current = new Map(current);
      }

      onSave();
      clearDraft();
      lastSavedDataRef.current = { ...formData };
      message.success(t("storyEditor.sceneSaved"));
    } catch (error) {
      console.error("Failed to save scene:", error);
      message.error(t("storyEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleAppearanceToggle = (characterId: string) => {
    setFormData(prev => {
      const next = { ...prev.appearances };
      if (next[characterId]) {
        delete next[characterId];
      } else {
        next[characterId] = { checked: true, role: "supporting" };
      }
      return { ...prev, appearances: next };
    });
  };

  const handleRoleChange = (characterId: string, role: SceneRole) => {
    setFormData(prev => {
      const existing = prev.appearances[characterId];
      if (!existing) return prev;
      return {
        ...prev,
        appearances: {
          ...prev.appearances,
          [characterId]: { ...existing, role },
        },
      };
    });
  };

  const wordCount = formData.content.length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText size={16} />
          <span className="truncate">{structure.title}</span>
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          data-save-trigger="true"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {t("storyEditor.save")}
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Synopsis */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Type size={12} />
            {t("storyEditor.synopsis")}
          </label>
          <textarea
            value={formData.synopsis}
            onChange={(e) =>
              setFormData({ ...formData, synopsis: e.target.value })
            }
            placeholder={t("storyEditor.synopsisPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Content Editor */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <FileText size={12} />
            {t("storyEditor.content")}
          </label>
          <textarea
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder={t("storyEditor.contentPlaceholder")}
            className="w-full px-3 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono leading-relaxed"
            rows={15}
          />
          <div className="mt-1.5 text-right">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("storyEditor.wordCount", { count: wordCount })}
            </span>
          </div>
        </div>

        {/* Metadata Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("storyEditor.metadata")}
          </h4>

          {/* POV Character */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <User size={12} />
              {t("storyEditor.povCharacter")}
            </label>
            <select
              value={formData.povCharacterId}
              onChange={(e) =>
                setFormData({ ...formData, povCharacterId: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{t("storyEditor.noPov")}</option>
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <MapPin size={12} />
              {t("storyEditor.location")}
            </label>
            <input
              type="text"
              value={formData.locationName}
              onChange={(e) =>
                setFormData({ ...formData, locationName: e.target.value })
              }
              placeholder={t("storyEditor.locationPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Time Setting */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Clock size={12} />
              {t("storyEditor.timeSetting")}
            </label>
            <input
              type="text"
              value={formData.timeSetting}
              onChange={(e) =>
                setFormData({ ...formData, timeSetting: e.target.value })
              }
              placeholder={t("storyEditor.timePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Writing Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("storyEditor.writingStatus")}
            </label>
            <div className="flex gap-2">
              {[
                { value: "draft", label: t("storyEditor.status.draft"), color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600" },
                { value: "revising", label: t("storyEditor.status.revising"), color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" },
                { value: "complete", label: t("storyEditor.status.complete"), color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" },
              ].map(status => (
                <button
                  key={status.value}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      writingStatus: status.value as WritingStatus,
                    })
                  }
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${formData.writingStatus === status.value
                      ? `${status.color} ring-2 ring-offset-1`
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Characters in Scene */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckSquare size={12} />
            {t("storyEditor.charactersInScene")}
          </h4>
          {characters.length === 0 ? (
            <p className="text-xs text-gray-400 italic">{t("storyEditor.noCharactersAvailable")}</p>
          ) : (
            <div className="space-y-2">
              {characters.map(character => {
                const appearanceEntry = formData.appearances[character.id];
                const isChecked = !!appearanceEntry;
                const currentRole = appearanceEntry?.role || "supporting";

                return (
                  <div
                    key={character.id}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                      isChecked
                        ? "border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleAppearanceToggle(character.id)}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <span className="flex-1 text-sm text-gray-900 dark:text-white font-medium">
                      {character.name}
                    </span>
                    {isChecked && (
                      <select
                        value={currentRole}
                        onChange={(e) => handleRoleChange(character.id, e.target.value as SceneRole)}
                        className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="protagonist">{t("storyEditor.roles.protagonist")}</option>
                        <option value="antagonist">{t("storyEditor.roles.antagonist")}</option>
                        <option value="supporting">{t("storyEditor.roles.supporting")}</option>
                        <option value="minor">{t("storyEditor.roles.minor")}</option>
                        <option value="mentioned">{t("storyEditor.roles.mentioned")}</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {!loading && showRestorePrompt && (
        <ConfirmationModal
          isOpen={showRestorePrompt}
          onClose={onDiscard}
          onConfirm={onRestore}
          title={t("common.restoreDraftTitle")}
          message={t("common.restoreDraftMessage")}
          isDangerous={false}
        />
      )}
    </div>
  );
};

export default SceneEditor;
