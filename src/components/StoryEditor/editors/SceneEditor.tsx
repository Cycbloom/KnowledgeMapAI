import React, { useState, useEffect } from "react";
import { Save, Loader2, FileText, MapPin, Clock, User, Type, CheckSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { storyCreationApi } from "../../../services/api/storyCreation";
import type { StoryStructure, StoryCharacter, StorySceneDetail } from "../../../services/api/storyCreation";

interface SceneEditorProps {
  graphId: string;
  structure: StoryStructure;
  characters: StoryCharacter[];
  onSave: () => void;
}

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

  const [synopsis, setSynopsis] = useState("");
  const [content, setContent] = useState("");
  const [povCharacterId, setPovCharacterId] = useState<string>("");
  const [locationName, setLocationName] = useState("");
  const [timeSetting, setTimeSetting] = useState("");
  const [writingStatus, setWritingStatus] = useState<"draft" | "revising" | "complete">("draft");
  const [appearances, setAppearances] = useState<Map<string, { checked: boolean; role: string }>>(new Map());

  useEffect(() => {
    loadSceneData();
  }, [structure.id]);

  const loadSceneData = async () => {
    try {
      setLoading(true);
      const result = await storyCreationApi.scenes.get(graphId, structure.id);
      if (result.scene) {
        setSceneData(result.scene);
        setSynopsis(result.scene.synopsis || "");
        setContent(result.scene.content || "");
        setPovCharacterId(result.scene.pov_character_id || "");
        setLocationName(result.scene.location_name || "");
        setTimeSetting(result.scene.time_setting || "");
        setWritingStatus(result.scene.writing_status || "draft");

        if (result.scene.appearances) {
          const appearanceMap = new Map<string, { checked: boolean; role: string }>();
          result.scene.appearances.forEach((appearance: { character_id: string; role_in_scene: string }) => {
            appearanceMap.set(appearance.character_id, {
              checked: true,
              role: appearance.role_in_scene,
            });
          });
          setAppearances(appearanceMap);
        }
      }
    } catch (error) {
      console.error("Failed to load scene data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (sceneData) {
        await storyCreationApi.scenes.update(graphId, sceneData.id, {
          synopsis,
          content,
          pov_character_id: povCharacterId || null,
          location_name: locationName || null,
          time_setting: timeSetting || null,
          writing_status: writingStatus,
          word_count: content.length,
        });
      } else {
        const newScene = await storyCreationApi.scenes.create(graphId, {
          structure_id: structure.id,
          synopsis,
          content,
          pov_character_id: povCharacterId || undefined,
          location_name: locationName || undefined,
          time_setting: timeSetting || undefined,
          writing_status: writingStatus,
          word_count: content.length,
        });
        setSceneData(newScene);
      }

      onSave();
    } catch (error) {
      console.error("Failed to save scene:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAppearanceToggle = (characterId: string) => {
    setAppearances(prev => {
      const next = new Map(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.set(characterId, { checked: true, role: "supporting" });
      }
      return next;
    });
  };

  const handleRoleChange = (characterId: string, role: string) => {
    setAppearances(prev => {
      const next = new Map(prev);
      if (next.has(characterId)) {
        next.set(characterId, { ...next.get(characterId)!, role });
      }
      return next;
    });
  };

  const wordCount = content.length;

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
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
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
              value={povCharacterId}
              onChange={(e) => setPovCharacterId(e.target.value)}
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
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
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
              value={timeSetting}
              onChange={(e) => setTimeSetting(e.target.value)}
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
                  onClick={() => setWritingStatus(status.value as typeof writingStatus)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                    ${writingStatus === status.value
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
                const isChecked = appearances.has(character.id);
                const currentRole = appearances.get(character.id)?.role || "supporting";

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
                        onChange={(e) => handleRoleChange(character.id, e.target.value)}
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
    </div>
  );
};

export default SceneEditor;
