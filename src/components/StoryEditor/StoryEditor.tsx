import React, { useState, useEffect, useCallback } from "react";
import { Loader2, BookOpen, Users, Settings, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { message } from "../../utils/messageHelper";
import { storyCreationApi } from "../../services/api/storyCreation";
import type { StoryStructure, StoryCharacter } from "../../services/api/storyCreation";

import { StructurePanel } from "./panels/StructurePanel";
import { CharacterPanel } from "./panels/CharacterPanel";
import { SceneEditor } from "./editors/SceneEditor";
import { CharacterEditor } from "./editors/CharacterEditor";

interface StoryEditorProps {
  graphId: string;
  graphMeta?: any;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ graphId, graphMeta }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [structures, setStructures] = useState<StoryStructure[]>([]);
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<StoryStructure | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<StoryCharacter | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStoryData();
  }, [graphId]);

  const loadStoryData = useCallback(async () => {
    try {
      setLoading(true);
      const [structsResult, charsResult] = await Promise.all([
        storyCreationApi.structures.list(graphId),
        storyCreationApi.characters.list(graphId),
      ]);
      setStructures(structsResult.structures || []);
      setCharacters(charsResult.characters || []);
    } catch (error) {
      console.error("Failed to load story data:", error);
      message.error(t("storyEditor.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [graphId, t]);

  const handleInitializeTemplate = useCallback(async (templateCode: string) => {
    setInitializing(true);
    try {
      const result = await storyCreationApi.structures.initializeTemplate(graphId, templateCode);
      setStructures(result.structures || []);
      message.success(t("storyEditor.templateInitialized", { template: result.templateName }));
    } catch (error) {
      console.error("Failed to initialize template:", error);
      message.error(t("storyEditor.initializeFailed"));
    } finally {
      setInitializing(false);
    }
  }, [graphId, t]);

  const handleSelectStructure = useCallback((structure: StoryStructure) => {
    setSelectedStructure(structure);
    setSelectedCharacter(null);
  }, []);

  const handleSelectCharacter = useCallback((character: StoryCharacter) => {
    setSelectedCharacter(character);
    setSelectedStructure(null);
  }, []);

  const handleAddChildStructure = useCallback(async (parentId: string, level: StoryStructure["structure_level"]) => {
    try {
      const newStructure = await storyCreationApi.structures.create(graphId, {
        structure_level: level,
        parent_structure_id: parentId,
        title: t("storyEditor.newNodeTitle"),
        display_order: 0,
      });

      setStructures(prev => addToTree(prev, newStructure, parentId));
      message.success(t("storyEditor.nodeCreated"));
    } catch (error) {
      console.error("Failed to add child structure:", error);
      message.error(t("storyEditor.createFailed"));
    }
  }, [graphId, t]);

  const handleDeleteStructure = useCallback(async (id: string) => {
    try {
      await storyCreationApi.structures.delete(graphId, id);
      setStructures(prev => removeFromTree(prev, id));
      if (selectedStructure?.id === id) {
        setSelectedStructure(null);
      }
      message.success(t("storyEditor.nodeDeleted"));
    } catch (error) {
      console.error("Failed to delete structure:", error);
      message.error(t("storyEditor.deleteFailed"));
    }
  }, [graphId, selectedStructure, t]);

  const handleAddCharacter = useCallback(async () => {
    try {
      const newCharacter = await storyCreationApi.characters.create(graphId, {
        name: t("storyEditor.newCharacterName"),
        role_type: "supporting",
      });
      setCharacters(prev => [...prev, newCharacter]);
      message.success(t("storyEditor.characterCreated"));
    } catch (error) {
      console.error("Failed to create character:", error);
      message.error(t("storyEditor.characterCreateFailed"));
    }
  }, [graphId, t]);

  const handleDeleteCharacter = useCallback(async (id: string) => {
    try {
      await storyCreationApi.characters.delete(graphId, id);
      setCharacters(prev => prev.filter(c => c.id !== id));
      if (selectedCharacter?.id === id) {
        setSelectedCharacter(null);
      }
      message.success(t("storyEditor.characterDeleted"));
    } catch (error) {
      console.error("Failed to delete character:", error);
      message.error(t("storyEditor.characterDeleteFailed"));
    }
  }, [graphId, selectedCharacter, t]);

  const isSceneSelected = selectedStructure?.structure_level === "scene";

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">{t("storyEditor.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/graph/${graphId}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={t("storyEditor.backToGraph")}
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {graphMeta?.title || t("storyEditor.untitledStory")}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("storyEditor.storyCreationMode")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Settings size={16} />
            {t("storyEditor.settings")}
          </button>
          <button
            onClick={() => {
              setSaving(true);
              setTimeout(() => {
                setSaving(false);
                message.success(t("storyEditor.saved"));
              }, 500);
            }}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t("storyEditor.save")}
          </button>
        </div>
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Structure & Characters */}
        <div className="w-60 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
          {/* Structure Panel */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <StructurePanel
              structures={structures}
              selectedId={selectedStructure?.id || null}
              onSelect={handleSelectStructure}
              onAddChild={handleAddChildStructure}
              onDelete={handleDeleteStructure}
              onInitializeTemplate={handleInitializeTemplate}
              initializing={initializing}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-gray-700" />

          {/* Character Panel */}
          <div className="h-64 overflow-hidden flex flex-col flex-shrink-0">
            <CharacterPanel
              characters={characters}
              selectedId={selectedCharacter?.id || null}
              onSelect={handleSelectCharacter}
              onAdd={handleAddCharacter}
              onDelete={handleDeleteCharacter}
            />
          </div>
        </div>

        {/* Center Workspace */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
          {!selectedStructure && !selectedCharacter && structures.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {t("storyEditor.welcomeTitle")}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t("storyEditor.welcomeDescription")}
                </p>
              </div>
            </div>
          )}

          {!selectedStructure && !selectedCharacter && structures.length > 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {t("storyEditor.selectToEdit")}
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("storyEditor.selectHint")}
                </p>
              </div>
            </div>
          )}

          {selectedStructure && !isSceneSelected && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-xl p-8 border border-blue-100 dark:border-slate-600">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedStructure.title}
                </h2>
                {selectedStructure.synopsis && (
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {selectedStructure.synopsis}
                  </p>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                  <BookOpen size={14} />
                  {t(`storyEditor.levels.${selectedStructure.structure_level}`)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Detail Editor */}
        {(isSceneSelected || selectedCharacter) && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 overflow-y-auto flex-shrink-0">
            {isSceneSelected && selectedStructure && (
              <SceneEditor
                graphId={graphId}
                structure={selectedStructure}
                characters={characters}
                onSave={() => {
                  message.success(t("storyEditor.sceneSaved"));
                }}
              />
            )}

            {selectedCharacter && (
              <CharacterEditor
                graphId={graphId}
                character={selectedCharacter}
                onSave={(updatedCharacter) => {
                  setCharacters(prev =>
                    prev.map(c => c.id === updatedCharacter.id ? updatedCharacter : c)
                  );
                  message.success(t("storyEditor.characterSaved"));
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function addToTree(structures: StoryStructure[], newNode: StoryStructure, parentId: string): StoryStructure[] {
  return structures.map(node => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), newNode]
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: addToTree(node.children, newNode, parentId)
      };
    }
    return node;
  });
}

function removeFromTree(structures: StoryStructure[], id: string): StoryStructure[] {
  return structures
    .filter(node => node.id !== id)
    .map(node => ({
      ...node,
      children: node.children ? removeFromTree(node.children, id) : undefined
    }));
}

export default StoryEditor;
