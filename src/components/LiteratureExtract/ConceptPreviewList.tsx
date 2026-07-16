import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Check,
  AlertCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  ExtractedConcept,
  BackboneModule,
  ConceptType,
  BACKBONE_MODULE_LABELS,
  BACKBONE_MODULE_COLORS,
  CONCEPT_TYPE_LABELS,
  CONCEPT_TYPE_COLORS,
  CONCEPT_TO_MODULE_MAP,
} from "../../../shared/types/graph";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

export interface ConceptPreviewListProps {
  concepts: ExtractedConcept[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedConcepts: ExtractedConcept[]) => void;
  onEdit?: (concept: ExtractedConcept, index: number) => void;
  title?: string;
  description?: string;
}

interface ConceptCardProps {
  concept: ExtractedConcept;
  isSelected: boolean;
  isEditing: boolean;
  editedConcept: ExtractedConcept | null;
  onToggleSelect: () => void;
  onEdit: () => void;
  onSaveEdit: (updated: ExtractedConcept) => void;
  onCancelEdit: () => void;
  onModuleChange: (module: BackboneModule) => void;
  isDark: boolean;
}

const ConceptCard: React.FC<ConceptCardProps> = ({
  concept,
  isSelected,
  isEditing,
  editedConcept,
  onToggleSelect,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onModuleChange,
  isDark,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const currentConcept = editedConcept ?? concept;
  const conceptColor = CONCEPT_TYPE_COLORS[currentConcept.type];
  const moduleColor =
    BACKBONE_MODULE_COLORS[
      currentConcept.targetModule ?? CONCEPT_TO_MODULE_MAP[currentConcept.type]
    ];

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onModuleChange(e.target.value as BackboneModule);
  };

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isSelected
          ? isDark
            ? "border-primary-500 bg-primary-900/20"
            : "border-primary-500 bg-primary-50"
          : isDark
            ? "border-slate-700 bg-slate-800/50"
            : "border-gray-200 bg-white"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggleSelect}
            className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
              isSelected
                ? "bg-primary-600 border-primary-600 text-white"
                : isDark
                  ? "border-slate-600 hover:border-primary-500"
                  : "border-gray-300 hover:border-primary-500"
            }`}
          >
            {isSelected && <Check size={14} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`font-medium ${
                  isDark ? "text-slate-100" : "text-gray-900"
                }`}
              >
                {currentConcept.title}
              </h4>
              <span
                className="px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: `${conceptColor}20`,
                  color: conceptColor,
                }}
              >
                {CONCEPT_TYPE_LABELS[currentConcept.type]}
              </span>
              {currentConcept.similarity !== undefined && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    currentConcept.similarity >= 0.8
                      ? isDark
                        ? "bg-yellow-900/30 text-yellow-300"
                        : "bg-yellow-100 text-yellow-700"
                      : isDark
                        ? "bg-blue-900/30 text-blue-300"
                        : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {currentConcept.similarity >= 0.8 ? (
                    <span className="flex items-center gap-1">
                      <AlertCircle size={12} />
                      {t("literatureExtract.similarityHigh", {
                        percent: Math.round(currentConcept.similarity * 100),
                      })}
                    </span>
                  ) : (
                    t("literatureExtract.similarity", {
                      percent: Math.round(currentConcept.similarity * 100),
                    })
                  )}
                </span>
              )}
            </div>

            <p
              className={`mt-1 text-sm line-clamp-2 ${
                isDark ? "text-slate-400" : "text-gray-600"
              }`}
            >
              {currentConcept.description}
            </p>

            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Layers
                  size={14}
                  className={isDark ? "text-slate-500" : "text-gray-400"}
                />
                {isEditing ? (
                  <select
                    value={
                      currentConcept.targetModule ??
                      CONCEPT_TO_MODULE_MAP[currentConcept.type]
                    }
                    onChange={handleModuleChange}
                    className={`text-xs px-2 py-1 rounded border ${
                      isDark
                        ? "bg-slate-700 border-slate-600 text-slate-200"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    {Object.entries(BACKBONE_MODULE_LABELS).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${moduleColor}20`,
                      color: moduleColor,
                    }}
                  >
                    {
                      BACKBONE_MODULE_LABELS[
                        currentConcept.targetModule ??
                          CONCEPT_TO_MODULE_MAP[currentConcept.type]
                      ]
                    }
                  </span>
                )}
              </div>

              {currentConcept.similarTo && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    isDark ? "text-slate-500" : "text-gray-500"
                  }`}
                >
                  <Sparkles size={12} />
                  {t("literatureExtract.similarTo")}: {currentConcept.similarTo}
                </span>
              )}
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`mt-2 text-xs flex items-center gap-1 transition-colors ${
                isDark
                  ? "text-slate-400 hover:text-slate-300"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} />
                  {t("literatureExtract.lessInfo")}
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  {t("literatureExtract.moreInfo")}
                </>
              )}
            </button>

            {isExpanded && (
              <div
                className={`mt-3 pt-3 border-t text-sm ${
                  isDark
                    ? "border-slate-700 text-slate-400"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                <div className="flex items-start gap-2">
                  <BookOpen size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">
                      {t("literatureExtract.source")}:
                    </span>{" "}
                    {currentConcept.source.title}
                    {currentConcept.source.authors && (
                      <span> - {currentConcept.source.authors.join(", ")}</span>
                    )}
                    {currentConcept.source.year && (
                      <span> ({currentConcept.source.year})</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isEditing && (
              <button
                onClick={onEdit}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400 hover:text-slate-300"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                }`}
                title={t("common.edit")}
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <div
            className={`mt-4 pt-4 border-t ${
              isDark ? "border-slate-700" : "border-gray-200"
            }`}
          >
            <div className="space-y-3">
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("literatureExtract.conceptTitle")}
                </label>
                <input
                  type="text"
                  value={currentConcept.title}
                  onChange={(e) =>
                    onSaveEdit({ ...currentConcept, title: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-slate-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("literatureExtract.description")}
                </label>
                <textarea
                  value={currentConcept.description}
                  onChange={(e) =>
                    onSaveEdit({
                      ...currentConcept,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className={`w-full px-3 py-2 text-sm rounded-lg border resize-none ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-slate-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-medium mb-1 ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("literatureExtract.conceptType")}
                </label>
                <select
                  value={currentConcept.type}
                  onChange={(e) =>
                    onSaveEdit({
                      ...currentConcept,
                      type: e.target.value as ConceptType,
                    })
                  }
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    isDark
                      ? "bg-slate-700 border-slate-600 text-slate-100"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                >
                  {Object.entries(CONCEPT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={onCancelEdit}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    isDark
                      ? "border-slate-600 text-slate-300 hover:bg-slate-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => onSaveEdit(currentConcept)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ConceptPreviewList: React.FC<ConceptPreviewListProps> = ({
  concepts,
  isOpen,
  onClose,
  onConfirm,
  onEdit,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(concepts.map((_, i) => i)),
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedConcepts, setEditedConcepts] = useState<
    Map<number, ExtractedConcept>
  >(new Map());

  const isDark = document.documentElement.classList.contains("dark");

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIndices(new Set(concepts.map((_, i) => i)));
  }, [concepts]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index);
  }, []);

  const handleSaveEdit = useCallback(
    (index: number, updated: ExtractedConcept) => {
      setEditedConcepts((prev) => {
        const next = new Map(prev);
        next.set(index, updated);
        return next;
      });
      if (onEdit) {
        onEdit(updated, index);
      }
    },
    [onEdit],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const handleModuleChange = useCallback(
    (index: number, module: BackboneModule) => {
      setEditedConcepts((prev) => {
        const current = prev.get(index) ?? concepts[index];
        const next = new Map(prev);
        next.set(index, { ...current, targetModule: module });
        return next;
      });
    },
    [concepts],
  );

  const handleConfirm = useCallback(() => {
    const selectedConcepts = Array.from(selectedIndices).map(
      (index) => editedConcepts.get(index) ?? concepts[index],
    );
    onConfirm(selectedConcepts);
  }, [selectedIndices, editedConcepts, concepts, onConfirm]);

  if (!isOpen) return null;

  const selectedCount = selectedIndices.size;
  const totalCount = concepts.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div ref={containerRef} className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700 max-h-[90dvh] flex flex-col">
        <div className="p-4 sm:p-6 border-b dark:border-slate-700 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title ?? t("literatureExtract.previewTitle")}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("literatureExtract.selectedCount", {
                selected: selectedCount,
                total: totalCount,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t("common.selectAll")}
              </button>
              <button
                onClick={handleDeselectAll}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t("common.deselectAll")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {concepts.map((concept, index) => (
            <ConceptCard
              key={index}
              concept={concept}
              isSelected={selectedIndices.has(index)}
              isEditing={editingIndex === index}
              editedConcept={editedConcepts.get(index) ?? null}
              onToggleSelect={() => handleToggleSelect(index)}
              onEdit={() => handleEdit(index)}
              onSaveEdit={(updated) => handleSaveEdit(index, updated)}
              onCancelEdit={handleCancelEdit}
              onModuleChange={(module) => handleModuleChange(index, module)}
              isDark={isDark}
            />
          ))}

          {concepts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {t("literatureExtract.noConcepts")}
              </p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-slate-900/50 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t dark:border-slate-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 rounded-lg sm:rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-offset-slate-800 dark:focus:ring-slate-700 min-h-[44px] font-medium"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 text-white rounded-lg sm:rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[44px] font-medium ${
              selectedCount === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 dark:focus:ring-offset-slate-800"
            }`}
          >
            {t("literatureExtract.confirmAdd", { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConceptPreviewList;
