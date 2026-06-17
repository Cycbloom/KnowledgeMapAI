import React, { useState, useEffect } from "react";
import {
  Save,
  Loader2,
  User,
  Palette,
  Heart,
  Brain,
  Target,
  Shield,
  BookOpen,
  TrendingUp,
  Link2,
  Film,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { storyCreationHttpApi } from "../../../services/api/storyCreation";
import { message } from "../../../utils/messageHelper";
import type { StoryCharacter } from "../../../services/api/storyCreation";

interface CharacterEditorProps {
  graphId: string;
  character: StoryCharacter;
  onSave: (updatedCharacter: StoryCharacter) => void;
}

export const CharacterEditor: React.FC<CharacterEditorProps> = ({
  graphId,
  character,
  onSave,
}) => {
  const { t } = useTranslation();

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(character.name);
  const [roleType, setRoleType] = useState<StoryCharacter["role_type"]>(
    character.role_type,
  );
  const [archetype, setArchetype] = useState(character.archetype || "");
  const [appearance, setAppearance] = useState(character.appearance || "");
  const [age, setAge] = useState(character.age || "");
  const [gender, setGender] = useState(character.gender || "");

  const [motivation, setMotivation] = useState(character.motivation || "");
  const [fear, setFear] = useState(character.fear || "");
  const [desire, setDesire] = useState(character.desire || "");
  const [flaw, setFlaw] = useState(character.flaw || "");

  const [backstory, setBackstory] = useState(character.backstory || "");
  const [arcStart, setArcStart] = useState(character.arc_start || "");
  const [arcEnd, setArcEnd] = useState(character.arc_end || "");

  // Reset form when character changes
  useEffect(() => {
    setName(character.name);
    setRoleType(character.role_type);
    setArchetype(character.archetype || "");
    setAppearance(character.appearance || "");
    setAge(character.age || "");
    setGender(character.gender || "");
    setMotivation(character.motivation || "");
    setFear(character.fear || "");
    setDesire(character.desire || "");
    setFlaw(character.flaw || "");
    setBackstory(character.backstory || "");
    setArcStart(character.arc_start || "");
    setArcEnd(character.arc_end || "");
  }, [
    character.id,
    character.name,
    character.role_type,
    character.archetype,
    character.appearance,
    character.age,
    character.gender,
    character.motivation,
    character.fear,
    character.desire,
    character.flaw,
    character.backstory,
    character.arc_start,
    character.arc_end,
  ]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatedCharacter = await storyCreationHttpApi.characters.update(
        graphId,
        character.id,
        {
          name,
          role_type: roleType,
          archetype: archetype || null,
          appearance: appearance || null,
          age: age || null,
          gender: gender || null,
          motivation: motivation || null,
          fear: fear || null,
          desire: desire || null,
          flaw: flaw || null,
          backstory: backstory || null,
          arc_start: arcStart || null,
          arc_end: arcEnd || null,
        },
      );
      onSave(updatedCharacter);
      message.success(t("storyEditor.characterSaved"));
    } catch (error) {
      console.error("Failed to save character:", error);
      message.error(t("storyEditor.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <User size={16} />
          <span className="truncate">{character.name}</span>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Basic Information Section */}
        <section className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette size={12} />
            {t("storyEditor.basicInfo")}
          </h4>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("storyEditor.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("storyEditor.namePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Role Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("storyEditor.roleType")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: "protagonist",
                  label: t("storyEditor.roles.protagonist"),
                  color:
                    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
                },
                {
                  value: "antagonist",
                  label: t("storyEditor.roles.antagonist"),
                  color:
                    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                },
                {
                  value: "supporting",
                  label: t("storyEditor.roles.supporting"),
                  color:
                    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                },
                {
                  value: "minor",
                  label: t("storyEditor.roles.minor"),
                  color:
                    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                },
              ].map((role) => (
                <button
                  key={role.value}
                  onClick={() =>
                    setRoleType(role.value as StoryCharacter["role_type"])
                  }
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    roleType === role.value
                      ? `${role.color} ring-2 ring-offset-1`
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Archetype */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("storyEditor.archetype")}
            </label>
            <input
              type="text"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder={t("storyEditor.archetypePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Appearance, Age, Gender Row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("storyEditor.age")}
              </label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("storyEditor.gender")}
              </label>
              <input
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder={t("storyEditor.genderPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("storyEditor.appearance")}
              </label>
              <input
                type="text"
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder={t("storyEditor.appearancePlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* Psychological Profile Section */}
        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Brain size={12} />
            {t("storyEditor.psychologicalProfile")}
          </h4>

          {/* Motivation */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Target size={12} />
              {t("storyEditor.motivation")}
            </label>
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder={t("storyEditor.motivationPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Fear */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Heart size={12} />
              {t("storyEditor.fear")}
            </label>
            <textarea
              value={fear}
              onChange={(e) => setFear(e.target.value)}
              placeholder={t("storyEditor.fearPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Desire */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Target size={12} />
              {t("storyEditor.desire")}
            </label>
            <textarea
              value={desire}
              onChange={(e) => setDesire(e.target.value)}
              placeholder={t("storyEditor.desirePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Flaw */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Shield size={12} />
              {t("storyEditor.flaw")}
            </label>
            <textarea
              value={flaw}
              onChange={(e) => setFlaw(e.target.value)}
              placeholder={t("storyEditor.flawPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={2}
            />
          </div>
        </section>

        {/* Backstory Section */}
        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={12} />
            {t("storyEditor.backstory")}
          </h4>
          <textarea
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder={t("storyEditor.backstoryPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={4}
          />
        </section>

        {/* Character Arc Section */}
        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={12} />
            {t("storyEditor.characterArc")}
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("storyEditor.arcStart")}
              </label>
              <input
                type="text"
                value={arcStart}
                onChange={(e) => setArcStart(e.target.value)}
                placeholder={t("storyEditor.arcStartPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("storyEditor.arcEnd")}
              </label>
              <input
                type="text"
                value={arcEnd}
                onChange={(e) => setArcEnd(e.target.value)}
                placeholder={t("storyEditor.arcEndPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* Statistics (Read-only) */}
        <section className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Film size={12} />
            {t("storyEditor.statistics")}
          </h4>

          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {character._count?.relationships ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                <Link2 size={10} />
                {t("storyEditor.relationshipCount")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {character._count?.appearances ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                <Film size={10} />
                {t("storyEditor.appearanceCount")}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CharacterEditor;
