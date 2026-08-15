import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Link,
  Upload,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  File,
  FileType,
  FileCode,
  Sparkles,
  ChevronUp,
  BookOpen,
  Layers,
  Search,
  Filter,
  RotateCcw,
  ClipboardPaste,
  Settings,
  Download,
  Copy,
} from "lucide-react";
import { useError, useIsMobile, useFormDraft } from "../../hooks";
import { message } from "../../utils/messageHelper";
import { literatureApi } from "../../services/api/literature";
import {
  CONCEPT_TYPE_COLORS,
  type LiteratureExtractRequest,
  type LiteratureExtractResponse,
  type ConceptType,
} from "@shared/types/graph";
import { getRelationshipTypeDisplayName } from "@/config/relationshipTypes";
import {
  LiteratureMetadataForm,
  type LiteratureMetadata,
} from "./LiteratureMetadataForm";
import { copyToClipboard } from "@/utils/clipboard";
import { ConfirmationModal } from "../common/ConfirmationModal";

type InputMode = "text" | "file" | "url";

const LITERATURE_EXTRACT_SETTINGS_KEY = "literature-extract-settings";

interface LiteratureExtractSettings {
  preferredCount: number;
  maxConcepts: number;
  similarityThreshold: number;
}

const DEFAULT_SETTINGS: LiteratureExtractSettings = {
  preferredCount: 13,
  maxConcepts: 50,
  similarityThreshold: 0.7,
};

function loadLiteratureExtractSettings(): LiteratureExtractSettings {
  try {
    const saved = localStorage.getItem(LITERATURE_EXTRACT_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<LiteratureExtractSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load literature extract settings:", error);
  }
  return DEFAULT_SETTINGS;
}

function saveLiteratureExtractSettings(
  settings: Partial<LiteratureExtractSettings>,
) {
  try {
    const current = loadLiteratureExtractSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(
      LITERATURE_EXTRACT_SETTINGS_KEY,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.error("Failed to save literature extract settings:", error);
  }
}

interface LiteratureExtractPanelProps {
  graphId: string;
  onExtractComplete?: (result: LiteratureExtractResponse) => void;
  onConceptsSaved?: (result: {
    addedCount: number;
    mergedCount: number;
  }) => void;
  onClose?: () => void;
  className?: string;
}

interface FileUploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
}

interface ProcessingProgress {
  stage: "uploading" | "parsing" | "extracting" | "complete" | "error";
  progress: number;
  message: string;
}

const ACCEPTED_FILE_TYPES = {
  pdf: ".pdf",
  word: ".doc,.docx",
  markdown: ".md,.markdown",
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="text-red-500" size={20} />;
    case "doc":
    case "docx":
      return <FileType className="text-blue-500" size={20} />;
    case "md":
    case "markdown":
      return <FileCode className="text-green-500" size={20} />;
    default:
      return <File className="text-gray-500" size={20} />;
  }
};

const getFileSizeDisplay = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface LiteratureDraft {
  inputMode: InputMode;
  textContent: string;
  urlInput: string;
  metadata: Partial<LiteratureMetadata>;
  selectedConceptTypes: ConceptType[];
}

const DEFAULT_CONCEPT_TYPES: ConceptType[] = [
  "concept",
  "method",
  "mechanism",
  "technology",
  "tool",
  "operation",
  "theory",
  "finding",
  "trend",
  "challenge",
];

const EMPTY_DRAFT: LiteratureDraft = {
  inputMode: "text",
  textContent: "",
  urlInput: "",
  metadata: {},
  selectedConceptTypes: DEFAULT_CONCEPT_TYPES,
};

export const LiteratureExtractPanel: React.FC<LiteratureExtractPanelProps> = ({
  graphId,
  onExtractComplete,
  onConceptsSaved,
  onClose,
  className = "",
}) => {
  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const { handleError } = useError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(darkQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    darkQuery.addEventListener("change", handler);
    return () => darkQuery.removeEventListener("change", handler);
  }, []);

  const {
    value: draft,
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<LiteratureDraft>({
    key: "literature_extract_draft",
    initialValue: EMPTY_DRAFT,
  });

  const { inputMode, textContent, urlInput, metadata, selectedConceptTypes } =
    draft;

  // 预构建选中概念类型集合，将渲染路径的选中判断由 O(types*selectedTypes) 降为 O(1)
  const selectedConceptTypeSet = useMemo(
    () => new Set(selectedConceptTypes),
    [selectedConceptTypes]
  );

  const [fileState, setFileState] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    error: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] =
    useState<ProcessingProgress | null>(null);
  const [extractedResult, setExtractedResult] =
    useState<LiteratureExtractResponse | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const savedSettings = loadLiteratureExtractSettings();
  const [maxConcepts, setMaxConcepts] = useState(savedSettings.maxConcepts);
  const [preferredCount, setPreferredCount] = useState(
    savedSettings.preferredCount,
  );
  const [similarityThreshold, setSimilarityThreshold] = useState(
    savedSettings.similarityThreshold,
  );
  const [isDetectingMetadata, setIsDetectingMetadata] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInputSection, setShowInputSection] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedFilterType, setSelectedFilterType] = useState<
    ConceptType | "all"
  >("all");
  const [showAllRelations, setShowAllRelations] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (extractedResult) {
      setShowInputSection(false);
    }
  }, [extractedResult]);

  useEffect(() => {
    saveLiteratureExtractSettings({
      preferredCount,
      maxConcepts,
      similarityThreshold,
    });
  }, [preferredCount, maxConcepts, similarityThreshold]);

  const conceptTypeOptions = [
    { value: "concept", labelKey: "literatureExtract.conceptTypes.concept" },
    { value: "method", labelKey: "literatureExtract.conceptTypes.method" },
    {
      value: "mechanism",
      labelKey: "literatureExtract.conceptTypes.mechanism",
    },
    {
      value: "technology",
      labelKey: "literatureExtract.conceptTypes.technology",
    },
    { value: "tool", labelKey: "literatureExtract.conceptTypes.tool" },
    {
      value: "operation",
      labelKey: "literatureExtract.conceptTypes.operation",
    },
    { value: "theory", labelKey: "literatureExtract.conceptTypes.theory" },
    { value: "finding", labelKey: "literatureExtract.conceptTypes.finding" },
    { value: "trend", labelKey: "literatureExtract.conceptTypes.trend" },
    {
      value: "challenge",
      labelKey: "literatureExtract.conceptTypes.challenge",
    },
  ] as const satisfies readonly { value: ConceptType; labelKey: string }[];

  const handleAutoDetectMetadata = useCallback(
    async (citationText: string) => {
      if (!citationText.trim()) {
        message.warning(t("literatureExtract.errors.noCitationText"));
        return;
      }

      setIsDetectingMetadata(true);
      try {
        const result = await literatureApi.extractMetadata({
          content: citationText.trim(),
        });

        const detectedMetadata: Partial<LiteratureMetadata> = {
          title: result.metadata.title,
          authors: result.metadata.authors,
          year: result.metadata.year,
          type: result.metadata.type,
          journal: result.metadata.journal,
          doi: result.metadata.doi,
          keywords: result.metadata.keywords,
        };

        setDraft((prev) => ({ ...prev, metadata: detectedMetadata }));

        message.success(t("literatureExtract.success.metadataDetected", {
          confidence: (result.confidence * 100).toFixed(0),
        }));
      } catch (error) {
        handleError(error, {
          context: "AutoDetectMetadata",
          fallbackMessage: t(
            "literatureExtract.errors.metadataDetectionFailed",
          ),
        });
      } finally {
        setIsDetectingMetadata(false);
      }
    },
    [handleError, t, setDraft],
  );

  const extractTitleFromFileName = useCallback((fileName: string): string => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const cleanedName = nameWithoutExt
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleanedName;
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validExtensions = Object.values(ACCEPTED_FILE_TYPES)
        .join(",")
        .split(",");
      const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;

      if (!validExtensions.includes(fileExt)) {
        setFileState({
          file: null,
          uploading: false,
          progress: 0,
          error: t("literatureExtract.errors.unsupportedFileType"),
        });
        return;
      }

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setFileState({
          file: null,
          uploading: false,
          progress: 0,
          error: t("literatureExtract.errors.fileTooLarge"),
        });
        return;
      }

      setFileState({
        file,
        uploading: false,
        progress: 0,
        error: null,
      });

      const inferredTitle = extractTitleFromFileName(file.name);
      if (inferredTitle && !metadata.title) {
        setDraft((prev) => ({
          ...prev,
          metadata: { ...prev.metadata, title: inferredTitle },
        }));
      }
    },
    [t, extractTitleFromFileName, metadata.title, setDraft],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        const validExtensions = Object.values(ACCEPTED_FILE_TYPES)
          .join(",")
          .split(",");
        const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;

        if (!validExtensions.includes(fileExt)) {
          setFileState({
            file: null,
            uploading: false,
            progress: 0,
            error: t("literatureExtract.errors.unsupportedFileType"),
          });
          return;
        }

        setFileState({
          file,
          uploading: false,
          progress: 0,
          error: null,
        });
      }
    },
    [t],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const handleRemoveFile = useCallback(() => {
    setFileState({ file: null, uploading: false, progress: 0, error: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleToggleConceptType = useCallback(
    (type: ConceptType) => {
      setDraft((prev) => ({
        ...prev,
        selectedConceptTypes: prev.selectedConceptTypes.includes(type)
          ? prev.selectedConceptTypes.filter((t) => t !== type)
          : [...prev.selectedConceptTypes, type],
      }));
    },
    [setDraft],
  );

  const validateInput = useCallback((): boolean => {
    switch (inputMode) {
      case "text":
        if (!textContent.trim()) {
          message.warning(t("literatureExtract.errors.textRequired"));
          return false;
        }
        if (textContent.trim().length < 100) {
          message.warning(t("literatureExtract.errors.textTooShort"));
          return false;
        }
        break;
      case "file":
        if (!fileState.file) {
          message.warning(t("literatureExtract.errors.fileRequired"));
          return false;
        }
        break;
      case "url":
        if (!urlInput.trim()) {
          message.warning(t("literatureExtract.errors.urlRequired"));
          return false;
        }
        try {
          new URL(urlInput);
        } catch {
          message.warning(t("literatureExtract.errors.invalidUrl"));
          return false;
        }
        break;
    }
    return true;
  }, [inputMode, textContent, fileState.file, urlInput, t]);

  const handleExtract = useCallback(async () => {
    if (!validateInput()) return;

    setIsProcessing(true);
    setProcessingProgress({
      stage: "uploading",
      progress: 0,
      message: t("literatureExtract.progress.uploading"),
    });
    setExtractedResult(null);

    try {
      const request: LiteratureExtractRequest = {
        graph_id: graphId,
        literature: metadata.title
          ? {
              title: metadata.title,
              authors: metadata.authors,
              year: metadata.year,
              type: metadata.type,
              url: inputMode === "url" ? urlInput : undefined,
              fileName:
                inputMode === "file" && fileState.file
                  ? fileState.file.name
                  : undefined,
            }
          : undefined,
        options: {
          extractTypes: selectedConceptTypes,
          maxConcepts,
          preferredCount,
          similarityThreshold,
          autoDetectMetadata: !metadata.title,
        },
      };

      if (inputMode === "text") {
        request.content = textContent;
      } else if (inputMode === "file" && fileState.file) {
        request.file = fileState.file;
      } else if (inputMode === "url") {
        request.url = urlInput;
      }

      setProcessingProgress({
        stage: "parsing",
        progress: 30,
        message: t("literatureExtract.progress.parsing"),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      setProcessingProgress({
        stage: "extracting",
        progress: 60,
        message: t("literatureExtract.progress.extracting"),
      });

      const result = await literatureApi.extractConcepts(request);

      setProcessingProgress({
        stage: "complete",
        progress: 100,
        message: t("literatureExtract.progress.complete"),
      });

      setExtractedResult(result);

      if (result.literature && !metadata.title) {
        const detectedMetadata: Partial<LiteratureMetadata> = {};
        if (result.literature.title)
          {detectedMetadata.title = result.literature.title;}
        if (result.literature.authors && result.literature.authors.length > 0)
          {detectedMetadata.authors = result.literature.authors;}
        if (result.literature.year)
          {detectedMetadata.year = result.literature.year;}
        if (result.literature.type)
          {detectedMetadata.type = result.literature.type;}
        if (result.literature.journal)
          {detectedMetadata.journal = result.literature.journal;}

        if (Object.keys(detectedMetadata).length > 0) {
          setDraft((prev) => ({
            ...prev,
            metadata: { ...prev.metadata, ...detectedMetadata },
          }));
        }
      }

      message.success(t("literatureExtract.success.extracted", {
        count: result.concepts.length,
      }));

      onExtractComplete?.(result);
    } catch (error) {
      setProcessingProgress({
        stage: "error",
        progress: 0,
        message: t("literatureExtract.errors.extractFailed"),
      });
      handleError(error, {
        context: "LiteratureExtract",
        fallbackMessage: t("literatureExtract.errors.extractFailed"),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    validateInput,
    graphId,
    inputMode,
    textContent,
    fileState.file,
    urlInput,
    selectedConceptTypes,
    maxConcepts,
    preferredCount,
    similarityThreshold,
    metadata,
    handleError,
    t,
    onExtractComplete,
    setDraft,
  ]);

  const handleSave = useCallback(async () => {
    if (!extractedResult) return;

    setIsSaving(true);
    try {
      const result = await literatureApi.applyConcepts({
        graph_id: graphId,
        concepts: extractedResult.concepts,
        relations: extractedResult.relations,
        literature: extractedResult.literature,
      });

      message.success(t("literatureExtract.success.saved", {
        addedCount: result.addedCount,
        mergedCount: result.mergedCount,
      }));

      onConceptsSaved?.({
        addedCount: result.addedCount,
        mergedCount: result.mergedCount,
      });
      clearDraft();
      onClose?.();
    } catch (error) {
      handleError(error, {
        context: "SaveConcepts",
        fallbackMessage: t("literatureExtract.errors.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [extractedResult, graphId, handleError, t, onClose, onConceptsSaved, clearDraft]);

  const handleReset = useCallback(() => {
    setExtractedResult(null);
    setDraft(EMPTY_DRAFT);
    setFileState({ file: null, uploading: false, progress: 0, error: null });
    setShowInputSection(true);
    setSearchText("");
    setSelectedFilterType("all");
    setShowAllRelations(false);
    setShowAdvancedOptions(false);
    setMaxConcepts(DEFAULT_SETTINGS.maxConcepts);
    setPreferredCount(DEFAULT_SETTINGS.preferredCount);
    setSimilarityThreshold(DEFAULT_SETTINGS.similarityThreshold);
  }, [setDraft]);

  const handleExport = useCallback(() => {
    if (!extractedResult) return;

    try {
      const exportData = {
        metadata: extractedResult.literature || {},
        concepts: extractedResult.concepts,
        relations: extractedResult.relations,
        extractedAt: new Date().toISOString(),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `literature-extract-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success(t("literatureExtract.success.exported"));
    } catch (error) {
      handleError(error, {
        context: "ExportData",
        fallbackMessage: t("literatureExtract.errors.exportFailed"),
      });
    }
  }, [extractedResult, handleError, t]);

  const handleCopySummary = useCallback(async () => {
    if (!extractedResult) return;

    const title = metadata.title || t("literatureExtract.noTitle");
    const authors =
      metadata.authors?.join(", ") || t("literatureExtract.noAuthors");
    const summaryText = [
      `${t("literatureExtract.toolbar.title")}: ${title}`,
      `${t("literatureExtract.toolbar.authors")}: ${authors}`,
      "",
      `${t("literatureExtract.result.conceptsCount")}: ${extractedResult.concepts.length}`,
      `${t("literatureExtract.result.relationsCount")}: ${extractedResult.relations.length}`,
    ].join("\n");

    const success = await copyToClipboard(summaryText, t("toast.common.copied"));
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1000);
    }
  }, [extractedResult, metadata, t]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText.trim()) {
        setDraft((prev) => ({
          ...prev,
          inputMode: "text",
          textContent: clipboardText,
        }));
        message.success(t("literatureExtract.success.pasted"));
      }
    } catch (_) {
      message.error(t("literatureExtract.errors.pasteFailed"));
    }
  }, [t, setDraft]);

  const renderInputModeSelector = () => (
    <div
      className={`grid ${isMobile ? "grid-cols-3 gap-1" : "grid-cols-3 gap-2"}`}
    >
      {(
        [
          { mode: "text" as InputMode, icon: FileText, labelKey: "text" },
          { mode: "file" as InputMode, icon: Upload, labelKey: "file" },
          { mode: "url" as InputMode, icon: Link, labelKey: "url" },
        ] as const
      ).map(({ mode, icon: Icon, labelKey }) => (
        <button
          key={mode}
          onClick={() => setDraft((prev) => ({ ...prev, inputMode: mode }))}
          disabled={isProcessing}
          className={`${isMobile ? "p-2" : "p-3"} rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
            inputMode === mode
              ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <Icon
            size={isMobile ? 18 : 20}
            className={
              inputMode === mode
                ? "text-primary-500"
                : "text-gray-400 dark:text-gray-500"
            }
          />
          <span
            className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium ${
              inputMode === mode
                ? "text-primary-600 dark:text-primary-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {t(`literatureExtract.inputMode.${labelKey}`)}
          </span>
        </button>
      ))}
    </div>
  );

  const renderTextInput = () => (
    <div className="space-y-2">
      <label
        className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
      >
        {t("literatureExtract.textInput.label")}
      </label>
      <textarea
        value={textContent}
        onChange={(e) => setDraft((prev) => ({ ...prev, textContent: e.target.value }))}
        placeholder={t("literatureExtract.textInput.placeholder")}
        className={`w-full ${isMobile ? "px-3 py-2 text-sm" : "px-4 py-3"} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white ${isMobile ? "min-h-[150px]" : "min-h-[200px]"} resize-y focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
        disabled={isProcessing}
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{t("literatureExtract.textInput.hint")}</span>
        <span>
          {t("literatureExtract.textInput.charCount", {
            count: textContent.length,
          })}
        </span>
      </div>
    </div>
  );

  const renderFileInput = () => (
    <div className="space-y-2">
      <label
        className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
      >
        {t("literatureExtract.fileInput.label")}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept={Object.values(ACCEPTED_FILE_TYPES).join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
        aria-label={t("literatureExtract.fileInput.label")}
      />

      {!fileState.file ? (
        <div
          role="button"
          aria-label={t('common.aria.dropzone')}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`${isMobile ? "p-4" : "p-8"} border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors text-center`}
        >
          <Upload
            size={isMobile ? 24 : 32}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-2"
          />
          <p
            className={`${isMobile ? "text-xs" : "text-sm"} text-gray-600 dark:text-gray-400`}
          >
            {t("literatureExtract.fileInput.dropzone")}
          </p>
          <p
            className={`${isMobile ? "text-[10px]" : "text-xs"} text-gray-400 dark:text-gray-500 mt-1`}
          >
            {t("literatureExtract.fileInput.supportedTypes")}
          </p>
        </div>
      ) : (
        <div
          className={`${isMobile ? "p-2" : "p-3"} border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-slate-700/50`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getFileIcon(fileState.file.name)}
              <div>
                <p
                  className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-900 dark:text-white truncate max-w-[200px]`}
                >
                  {fileState.file.name}
                </p>
                <p className="text-xs text-gray-400">
                  {getFileSizeDisplay(fileState.file.size)}
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              disabled={isProcessing}
              aria-label={t("literatureExtract.toolbar.removeFile")}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X size={16} className="text-gray-400" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {fileState.error && (
        <div className="flex items-center gap-2 text-red-500 text-xs">
          <AlertCircle size={14} />
          {fileState.error}
        </div>
      )}
    </div>
  );

  const renderUrlInput = () => (
    <div className="space-y-2">
      <label
        className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
      >
        {t("literatureExtract.urlInput.label")}
      </label>
      <div className="relative">
        <Link
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setDraft((prev) => ({ ...prev, urlInput: e.target.value }))}
          placeholder={t("literatureExtract.urlInput.placeholder")}
          className={`w-full ${isMobile ? "pl-9 pr-3 py-2 text-sm" : "pl-10 pr-4 py-3"} border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
          disabled={isProcessing}
        />
      </div>
      <p className="text-xs text-gray-400">
        {t("literatureExtract.urlInput.hint")}
      </p>
    </div>
  );

  const renderAdvancedOptionsContent = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {t("literatureExtract.options.conceptTypes")}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {conceptTypeOptions.map(({ value, labelKey }) => (
            <button
              key={value}
              onClick={() => handleToggleConceptType(value)}
              disabled={isProcessing}
              className={`px-2 py-1 text-[11px] rounded-full border transition-all ${
                selectedConceptTypeSet.has(value)
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                  : "border-gray-200 dark:border-slate-500 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t("literatureExtract.options.preferredCount")}
          </label>
          <input
            type="number"
            min={5}
            max={50}
            value={preferredCount}
            onChange={(e) =>
              setPreferredCount(
                Math.min(50, Math.max(5, Number(e.target.value))),
              )
            }
            disabled={isProcessing}
            className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-900 dark:text-white"
          />
          <span className="text-[10px] text-gray-400 mt-0.5">
            {t("literatureExtract.options.preferredCountHint")}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t("literatureExtract.options.maxConcepts")}
          </label>
          <input
            type="number"
            min={10}
            max={200}
            value={maxConcepts}
            onChange={(e) =>
              setMaxConcepts(
                Math.min(200, Math.max(10, Number(e.target.value))),
              )
            }
            disabled={isProcessing}
            className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-900 dark:text-white"
          />
          <span className="text-[10px] text-gray-400 mt-0.5">
            {t("literatureExtract.options.maxConceptsHint")}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t("literatureExtract.options.confidenceThreshold")}
          </label>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.05}
            value={similarityThreshold}
            onChange={(e) =>
              setSimilarityThreshold(
                Math.min(1, Math.max(0.1, Number(e.target.value))),
              )
            }
            disabled={isProcessing}
            className="w-full px-2 py-1.5 text-xs border rounded-md bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-500 text-gray-900 dark:text-white"
          />
        </div>
      </div>
    </div>
  );

  const renderProgressBar = () => {
    if (!processingProgress) return null;

    const stageColors = {
      uploading: "bg-blue-500",
      parsing: "bg-amber-500",
      extracting: "bg-primary-500",
      complete: "bg-green-500",
      error: "bg-red-500",
    };

    const stageIcons = {
      uploading: Loader2,
      parsing: FileText,
      extracting: Sparkles,
      complete: CheckCircle2,
      error: AlertCircle,
    };

    const StageIcon = stageIcons[processingProgress.stage];

    return (
      <div
        className={`${isMobile ? "p-3" : "p-4"} bg-gray-50 dark:bg-slate-700/50 rounded-lg`}
      >
        <div className="flex items-center gap-2 mb-2">
          <StageIcon
            size={16}
            className={`${
              processingProgress.stage === "uploading" ||
              processingProgress.stage === "parsing" ||
              processingProgress.stage === "extracting"
                ? "animate-spin"
                : ""
            } ${
              processingProgress.stage === "error"
                ? "text-red-500"
                : processingProgress.stage === "complete"
                  ? "text-green-500"
                  : "text-primary-500"
            }`}
          />
          <span
            className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
          >
            {processingProgress.message}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${processingProgress.progress}%` }}
            transition={{ duration: 0.3 }}
            className={`h-full rounded-full ${stageColors[processingProgress.stage]}`}
          />
        </div>
      </div>
    );
  };

  const renderResultSummary = () => {
    if (!extractedResult) return null;

    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
        <span className="font-semibold text-sm text-green-800 dark:text-green-300">
          {t("literatureExtract.result.title")}
        </span>
        <span className="w-px h-4 bg-green-300 dark:bg-green-700 flex-shrink-0" />
        <span className="text-sm text-green-700 dark:text-green-400 font-medium">
          {extractedResult.concepts.length}{" "}
          {t("literatureExtract.result.conceptsCount")}
        </span>
        <span className="text-green-500">·</span>
        <span className="text-sm text-green-700 dark:text-green-400 font-medium">
          {extractedResult.relations.length}{" "}
          {t("literatureExtract.result.relationsCount")}
        </span>
      </div>
    );
  };

  const renderStickyToolbar = () => (
    <div className="sticky top-0 z-20 rounded-lg border bg-gray-50 dark:bg-slate-900/95 backdrop-blur-md border-gray-200 dark:border-slate-500 shadow-sm mx-0 mb-4">
      <div className="flex items-center justify-between px-3 py-2">
        {!extractedResult ? renderInputToolbar() : renderResultToolbar()}
      </div>
      {!extractedResult && showAdvancedOptions && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-slate-500">
          {renderAdvancedOptionsContent()}
        </div>
      )}
    </div>
  );

  const renderInputToolbar = () => (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePasteFromClipboard}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
      >
        <ClipboardPaste size={14} />
        {!isMobile && t("literatureExtract.toolbar.paste")}
      </button>
      <button
        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
      >
        <Settings size={14} />
        {!isMobile && t("literatureExtract.toolbar.options")}
      </button>
      {onClose && (
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 ml-auto"
        >
          <X size={14} />
          {!isMobile && t("common.close")}
        </button>
      )}
    </div>
  );

  const renderResultToolbar = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowInputSection(!showInputSection)}
          title={
            showInputSection
              ? t("literatureExtract.viewResults")
              : t("literatureExtract.result.collapseInput")
          }
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
        >
          {showInputSection ? <Layers size={14} /> : <ChevronUp size={14} />}
          {!isMobile &&
            (showInputSection
              ? t("literatureExtract.viewResults")
              : t("literatureExtract.result.collapseInput"))}
        </button>
      </div>

      <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleReset}
          title={t("literatureExtract.toolbar.reset")}
          aria-label={t("literatureExtract.toolbar.reset")}
          className="flex items-center justify-center px-2 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>

        <button
          onClick={handleExport}
          title={t("literatureExtract.toolbar.export")}
          aria-label={t("literatureExtract.toolbar.export")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
        >
          <Download size={14} aria-hidden="true" />
        </button>

        <button
          onClick={handleCopySummary}
          title={t("literatureExtract.toolbar.copy")}
          aria-label={t("literatureExtract.toolbar.copy")}
          className={`flex items-center justify-center px-2 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
            copySuccess
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
          }`}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 mx-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSave}
          disabled={isSaving}
          title={t("literatureExtract.saveToGraph")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap flex-shrink-0 ${
            isSaving
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white opacity-50 cursor-not-allowed"
              : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {!isMobile && t("literatureExtract.saving")}
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              {!isMobile && t("literatureExtract.saveToGraph")}
            </>
          )}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
          >
            <X size={14} />
            {!isMobile && t("common.close")}
          </button>
        )}
      </div>
    </div>
  );

  const renderEnhancedConceptList = () => {
    if (!extractedResult) return null;

    let filteredConcepts = extractedResult.concepts;

    if (selectedFilterType !== "all") {
      filteredConcepts = filteredConcepts.filter(
        (concept) => concept.type === selectedFilterType,
      );
    }

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filteredConcepts = filteredConcepts.filter(
        (concept) =>
          concept.title.toLowerCase().includes(searchLower) ||
          (concept.description &&
            concept.description.toLowerCase().includes(searchLower)),
      );
    }

    if (filteredConcepts.length === 0) {
      return (
        <div
          className={`
            text-center py-8 rounded-lg border-2 border-dashed
            ${isDark ? "border-slate-700 text-slate-500" : "border-gray-200 text-gray-400"}
          `}
        >
          <Search size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t("literatureExtract.result.noResults")}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary-500" />
            <h3
              className={`${isMobile ? "text-sm" : "text-base"} font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {t("literatureExtract.result.conceptList")}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-slate-700 text-slate-400"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {filteredConcepts.length}/{extractedResult.concepts.length}
            </span>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
          {filteredConcepts.map((concept, index) => {
            const typeColor = CONCEPT_TYPE_COLORS[concept.type] || "#6B7280";
            const typeLabel = t(
              `literatureExtract.conceptTypes.${concept.type}`,
              concept.type,
            );

            return (
              <motion.div
                key={`${concept.title}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`
                  group p-3 rounded-lg border transition-all cursor-default
                  ${
                    isDark
                      ? "bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800"
                      : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`${isMobile ? "text-xs" : "text-sm"} font-medium ${isDark ? "text-white" : "text-gray-900"} truncate`}
                      >
                        {concept.title}
                      </span>
                      <span
                        className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full font-medium flex-shrink-0`}
                        style={{
                          backgroundColor: `${typeColor}20`,
                          color: typeColor,
                        }}
                      >
                        {typeLabel}
                      </span>
                    </div>
                    {concept.description && (
                      <p
                        className={`${isMobile ? "text-[10px]" : "text-xs"} ${isDark ? "text-slate-400" : "text-gray-500"} line-clamp-2`}
                      >
                        {concept.description}
                      </p>
                    )}
                    {concept.similarity !== undefined && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div
                          role="progressbar"
                          aria-valuenow={Math.round(concept.similarity * 100)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('common.aria.progress')}
                          className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden"
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${concept.similarity * 100}%` }}
                            transition={{ duration: 0.5, delay: index * 0.03 }}
                            className="h-full bg-primary-500 rounded-full"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {(concept.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const formatRelationType = (type: string): string => {
    // i18n: dynamic key from backend relationship type display name.
    // getRelationshipTypeDisplayName returns a preset i18n key when `type` is a
    // known preset, otherwise it returns the input `type` (an arbitrary
    // user/backend-supplied string that is rendered as-is by i18next fallback).
    return t((getRelationshipTypeDisplayName(type) || type) as never);
  };

  const renderEnhancedRelationList = () => {
    if (!extractedResult || extractedResult.relations.length === 0) return null;

    const displayRelations = showAllRelations
      ? extractedResult.relations
      : extractedResult.relations.slice(0, 10);

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-primary-500" />
            <h3
              className={`${isMobile ? "text-sm" : "text-base"} font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {t("literatureExtract.result.relationList")}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-slate-700 text-slate-400"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {extractedResult.relations.length}
            </span>
          </div>
          {extractedResult.relations.length > 10 && (
            <button
              onClick={() => setShowAllRelations(!showAllRelations)}
              className={`text-xs font-medium ${
                isDark
                  ? "text-primary-400 hover:text-primary-300"
                  : "text-primary-600 hover:text-primary-700"
              }`}
            >
              {showAllRelations
                ? t("literatureExtract.result.showLess")
                : t("literatureExtract.result.showAll", {
                    count: extractedResult.relations.length - 10,
                  })}
            </button>
          )}
        </div>

        <div className="max-h-[30vh] overflow-y-auto space-y-2 pr-1">
          {displayRelations.map((relation, index) => (
            <motion.div
              key={`${relation.source}-${relation.target}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`
                p-3 rounded-lg border transition-all
                ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700"
                    : "bg-white border-gray-200"
                }
              `}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {relation.source}
                </span>
                <span className="text-gray-400">→</span>
                <span
                  className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {relation.target}
                </span>
                <span
                  className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400`}
                >
                  {formatRelationType(relation.type)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {(relation.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  const renderSearchAndFilter = () => {
    if (!extractedResult) return null;

    const uniqueTypes = [
      ...new Set(extractedResult.concepts.map((c) => c.type)),
    ];

    return (
      <div className="space-y-3">
        <div
          role="search"
          aria-label={t('common.aria.searchWithTarget', { target: t('literatureExtract.title') })}
          className="relative"
        >
          <Search
            size={16}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? "text-slate-500" : "text-gray-400"
            }`}
          />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("literatureExtract.result.searchPlaceholder")}
            className={`
              w-full pl-9 pr-4 py-2 text-sm border rounded-lg transition-colors
              ${
                isDark
                  ? "border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              }
            `}
          />
        </div>

        {uniqueTypes.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter
              size={14}
              className={`flex-shrink-0 ${
                isDark ? "text-slate-500" : "text-gray-400"
              }`}
            />
            <button
              onClick={() => setSelectedFilterType("all")}
              className={`
                flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all
                ${
                  selectedFilterType === "all"
                    ? isDark
                      ? "bg-primary-600 text-white"
                      : "bg-primary-500 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }
              `}
            >
              {t("literatureExtract.result.filterAll")}
            </button>
            {uniqueTypes.map((type) => {
              const typeColor = CONCEPT_TYPE_COLORS[type] || "#6B7280";
              const typeLabel = t(
                `literatureExtract.conceptTypes.${type}`,
                type,
              );

              return (
                <button
                  key={type}
                  onClick={() => setSelectedFilterType(type)}
                  className={`
                    flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full transition-all
                    ${
                      selectedFilterType === type
                        ? "text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }
                  `}
                  style={
                    selectedFilterType === type
                      ? { backgroundColor: typeColor }
                      : {}
                  }
                >
                  {typeLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`literature-extract-panel bg-white dark:bg-slate-800 ${isMobile ? "rounded-none" : "rounded-xl"} shadow-lg ${isMobile ? "p-4" : "p-6"} w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto ${className}`}
    >
      {onClose && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            aria-label={t("common.aria.close")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center"
          >
            <X size={isMobile ? 18 : 20} aria-hidden="true" />
          </button>
        </div>
      )}

      {renderStickyToolbar()}

      <div className="space-y-4">
        <LiteratureMetadataForm
          metadata={metadata}
          onMetadataChange={(newMetadata) => setDraft((prev) => ({ ...prev, metadata: newMetadata }))}
          onAutoDetect={handleAutoDetectMetadata}
          isDetecting={isDetectingMetadata}
          isDark={false}
          disabled={isProcessing}
        />

        {!extractedResult || showInputSection ? (
          <>
            {renderInputModeSelector()}

            <AnimatePresence mode="wait">
              <motion.div
                key={inputMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {inputMode === "text" && renderTextInput()}
                {inputMode === "file" && renderFileInput()}
                {inputMode === "url" && renderUrlInput()}
              </motion.div>
            </AnimatePresence>

            {processingProgress && renderProgressBar()}

            <button
              onClick={handleExtract}
              disabled={isProcessing}
              className={`w-full ${isMobile ? "py-2.5 px-3 text-sm" : "py-3 px-4"} bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-lg hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isProcessing ? (
                <>
                  <Loader2
                    className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} animate-spin`}
                  />
                  {t("literatureExtract.processing")}
                </>
              ) : (
                <>
                  <Sparkles className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`} />
                  {t("literatureExtract.startExtract")}
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {renderResultSummary()}

            {renderSearchAndFilter()}

            {renderEnhancedConceptList()}

            {renderEnhancedRelationList()}
          </>
        )}
      </div>
      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={onRestore}
        title={t("common.restoreDraftTitle")}
        message={t("common.restoreDraftMessage")}
        isDangerous={false}
      />
    </div>
  );
};

export default LiteratureExtractPanel;
