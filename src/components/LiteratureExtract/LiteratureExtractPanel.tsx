import React, { useState, useCallback, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  BookOpen,
  Layers,
  Tag,
  Network,
} from "lucide-react";
import { useError, useIsMobile } from "../../hooks";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { literatureApi } from "../../services/api/literature";
import {
  CONCEPT_TYPE_COLORS,
  BACKBONE_MODULE_COLORS,
  CONCEPT_TO_MODULE_MAP,
  type LiteratureExtractRequest,
  type LiteratureExtractResponse,
  type ConceptType,
} from "@shared/types/graph";
import {
  LiteratureMetadataForm,
  type LiteratureMetadata,
} from "./LiteratureMetadataForm";

type InputMode = "text" | "file" | "url";

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

  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
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
  const [selectedConceptTypes, setSelectedConceptTypes] = useState<
    ConceptType[]
  >([
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
  ]);
  const [maxConcepts, setMaxConcepts] = useState(50);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [metadata, setMetadata] = useState<Partial<LiteratureMetadata>>({});
  const [isDetectingMetadata, setIsDetectingMetadata] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const conceptTypeOptions: { value: ConceptType; labelKey: string }[] = [
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
  ];

  const handleAutoDetectMetadata = useCallback(
    async (citationText: string) => {
      if (!citationText.trim()) {
        frontendEventBus.publish("message_show", {
          type: "warning",
          content: t("literatureExtract.errors.noCitationText"),
        });
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

        setMetadata(detectedMetadata);

        frontendEventBus.publish("message_show", {
          type: "success",
          content: t("literatureExtract.success.metadataDetected", {
            confidence: (result.confidence * 100).toFixed(0),
          }),
        });
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
    [handleError, t],
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
        setMetadata((prev) => ({
          ...prev,
          title: inferredTitle,
        }));
      }
    },
    [t, extractTitleFromFileName, metadata.title],
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

  const handleToggleConceptType = useCallback((type: ConceptType) => {
    setSelectedConceptTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const validateInput = useCallback((): boolean => {
    switch (inputMode) {
      case "text":
        if (!textContent.trim()) {
          frontendEventBus.publish("message_show", {
            type: "warning",
            content: t("literatureExtract.errors.textRequired"),
          });
          return false;
        }
        if (textContent.trim().length < 100) {
          frontendEventBus.publish("message_show", {
            type: "warning",
            content: t("literatureExtract.errors.textTooShort"),
          });
          return false;
        }
        break;
      case "file":
        if (!fileState.file) {
          frontendEventBus.publish("message_show", {
            type: "warning",
            content: t("literatureExtract.errors.fileRequired"),
          });
          return false;
        }
        break;
      case "url":
        if (!urlInput.trim()) {
          frontendEventBus.publish("message_show", {
            type: "warning",
            content: t("literatureExtract.errors.urlRequired"),
          });
          return false;
        }
        try {
          new URL(urlInput);
        } catch {
          frontendEventBus.publish("message_show", {
            type: "warning",
            content: t("literatureExtract.errors.invalidUrl"),
          });
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
        if (result.literature.title) detectedMetadata.title = result.literature.title;
        if (result.literature.authors && result.literature.authors.length > 0)
          detectedMetadata.authors = result.literature.authors;
        if (result.literature.year) detectedMetadata.year = result.literature.year;
        if (result.literature.type) detectedMetadata.type = result.literature.type;
        if (result.literature.journal) detectedMetadata.journal = result.literature.journal;

        if (Object.keys(detectedMetadata).length > 0) {
          setMetadata((prev) => ({ ...prev, ...detectedMetadata }));
        }
      }

      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("literatureExtract.success.extracted", {
          count: result.concepts.length,
        }),
      });

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
    similarityThreshold,
    metadata,
    handleError,
    t,
    onExtractComplete,
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

      frontendEventBus.publish("message_show", {
        type: "success",
        content: t("literatureExtract.success.saved", {
          addedCount: result.addedCount,
          mergedCount: result.mergedCount,
        }),
      });

      onConceptsSaved?.({
        addedCount: result.addedCount,
        mergedCount: result.mergedCount,
      });
      onClose?.();
    } catch (error) {
      handleError(error, {
        context: "SaveConcepts",
        fallbackMessage: t("literatureExtract.errors.saveFailed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [extractedResult, graphId, handleError, t, onClose, onConceptsSaved]);

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
          onClick={() => setInputMode(mode)}
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
        onChange={(e) => setTextContent(e.target.value)}
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
      />

      {!fileState.file ? (
        <div
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
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
            >
              <X size={16} className="text-gray-400" />
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
          onChange={(e) => setUrlInput(e.target.value)}
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

  const renderAdvancedOptions = () => (
    <AnimatePresence>
      {showAdvancedOptions && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="space-y-4 overflow-hidden"
        >
          <div>
            <label
              className={`block ${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300 mb-2`}
            >
              {t("literatureExtract.options.conceptTypes")}
            </label>
            <div className="flex flex-wrap gap-2">
              {conceptTypeOptions.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => handleToggleConceptType(value)}
                  disabled={isProcessing}
                  className={`${isMobile ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"} rounded-full border transition-all ${
                    selectedConceptTypes.includes(value)
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
              >
                {t("literatureExtract.options.maxConcepts")}
              </label>
              <span
                className={`${isMobile ? "text-xs" : "text-sm"} text-primary-600 dark:text-primary-400 font-medium`}
              >
                {maxConcepts}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              value={maxConcepts}
              onChange={(e) => setMaxConcepts(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              disabled={isProcessing}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label
                className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-700 dark:text-gray-300`}
              >
                {t("literatureExtract.options.similarityThreshold")}
              </label>
              <span
                className={`${isMobile ? "text-xs" : "text-sm"} text-primary-600 dark:text-primary-400 font-medium`}
              >
                {(similarityThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.1"
              value={similarityThreshold}
              onChange={(e) =>
                setSimilarityThreshold(parseFloat(e.target.value))
              }
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              disabled={isProcessing}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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

  const renderResult = () => {
    if (!extractedResult) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div
          className={`${isMobile ? "p-3" : "p-4"} bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-green-500" />
            <span
              className={`${isMobile ? "text-sm" : "text-base"} font-medium text-green-700 dark:text-green-400`}
            >
              {t("literatureExtract.result.title")}
            </span>
          </div>
          <div
            className={`${isMobile ? "text-xs" : "text-sm"} text-green-600 dark:text-green-300 space-y-1`}
          >
            <p>
              {t("literatureExtract.result.conceptsExtracted", {
                count: extractedResult.concepts.length,
              })}
            </p>
            <p>
              {t("literatureExtract.result.relationsFound", {
                count: extractedResult.relations.length,
              })}
            </p>
          </div>
        </div>

        {extractedResult.concepts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-primary-500" />
              <h3
                className={`${isMobile ? "text-sm" : "text-base"} font-semibold text-gray-900 dark:text-white`}
              >
                {t("literatureExtract.result.conceptList")}
              </h3>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {extractedResult.concepts.map((concept, index) => {
                const typeColor =
                  CONCEPT_TYPE_COLORS[concept.type] || "#6B7280";
                const typeLabel = t(
                  `literatureExtract.conceptTypes.${concept.type}`,
                  concept.type,
                );

                const targetModule =
                  concept.targetModule ||
                  CONCEPT_TO_MODULE_MAP[concept.type] ||
                  "core_concepts";
                const moduleColor = targetModule
                  ? BACKBONE_MODULE_COLORS[targetModule]
                  : "#6B7280";
                const moduleLabel = targetModule
                  ? t(
                      `literatureExtract.backboneModule.${targetModule}`,
                      targetModule,
                    )
                  : null;

                return (
                  <motion.div
                    key={`${concept.title}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`${isMobile ? "p-2" : "p-3"} bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-gray-900 dark:text-white truncate`}
                          >
                            {concept.title}
                          </span>
                          <span
                            className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full font-medium`}
                            style={{
                              backgroundColor: `${typeColor}20`,
                              color: typeColor,
                            }}
                          >
                            {typeLabel}
                          </span>
                          {moduleLabel && (
                            <span
                              className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full font-medium`}
                              style={{
                                backgroundColor: `${moduleColor}20`,
                                color: moduleColor,
                              }}
                            >
                              {moduleLabel}
                            </span>
                          )}
                          {concept.crossGraphMatch && (
                            <span
                              className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full font-medium inline-flex items-center gap-1 bg-orange-500/15 text-orange-600 dark:text-orange-500`}
                            >
                              <Network size={isMobile ? 10 : 12} />
                              已在图谱「{concept.crossGraphMatch.graphTitle}
                              」中存在 (
                              {(
                                concept.crossGraphMatch.similarity * 100
                              ).toFixed(0)}
                              %)
                            </span>
                          )}
                        </div>
                        {concept.description && (
                          <p
                            className={`${isMobile ? "text-[10px]" : "text-xs"} text-gray-600 dark:text-gray-400 line-clamp-2`}
                          >
                            {concept.description}
                          </p>
                        )}
                        {concept.similarity !== undefined && (
                          <div className="flex items-center gap-1 mt-1">
                            <Tag size={12} className="text-gray-400" />
                            <span className="text-[10px] text-gray-500">
                              {t("literatureExtract.result.similarity", {
                                value: (concept.similarity * 100).toFixed(0),
                              })}
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
        )}

        {extractedResult.relations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-primary-500" />
              <h3
                className={`${isMobile ? "text-sm" : "text-base"} font-semibold text-gray-900 dark:text-white`}
              >
                {t("literatureExtract.result.relationList")}
              </h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {extractedResult.relations.map((relation, index) => (
                <motion.div
                  key={`${relation.source}-${relation.target}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${isMobile ? "p-2" : "p-3"} bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium text-gray-900 dark:text-white`}
                    >
                      {relation.source}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span
                      className={`${isMobile ? "text-[10px]" : "text-xs"} font-medium text-gray-900 dark:text-white`}
                    >
                      {relation.target}
                    </span>
                    <span
                      className={`${isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400`}
                    >
                      {relation.type}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {t("literatureExtract.result.confidence", {
                        value: (relation.confidence * 100).toFixed(0),
                      })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div
      className={`literature-extract-panel bg-white dark:bg-slate-800 ${isMobile ? "rounded-none" : "rounded-xl"} shadow-lg ${isMobile ? "p-4" : "p-6"} w-full ${isMobile ? "h-full" : "max-w-2xl max-h-[90vh]"} overflow-y-auto ${className}`}
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3">
          <div
            className={`${isMobile ? "p-1.5" : "p-2"} bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg`}
          >
            <FileText
              className={`${isMobile ? "w-5 h-5" : "w-6 h-6"} text-white`}
            />
          </div>
          <div>
            <h2
              className={`${isMobile ? "text-lg" : "text-xl"} font-bold text-gray-900 dark:text-white`}
            >
              {t("literatureExtract.title")}
            </h2>
            <p
              className={`${isMobile ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400`}
            >
              {t("literatureExtract.subtitle")}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X size={isMobile ? 18 : 20} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {renderInputModeSelector()}

        <LiteratureMetadataForm
          metadata={metadata}
          onMetadataChange={setMetadata}
          onAutoDetect={handleAutoDetectMetadata}
          isDetecting={isDetectingMetadata}
          isDark={false}
          disabled={isProcessing}
        />

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

        <button
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className={`flex items-center gap-2 ${isMobile ? "text-xs" : "text-sm"} text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200`}
        >
          {showAdvancedOptions ? (
            <ChevronUp size={isMobile ? 14 : 16} />
          ) : (
            <ChevronDown size={isMobile ? 14 : 16} />
          )}
          {t("literatureExtract.options.advanced")}
        </button>

        {renderAdvancedOptions()}

        {processingProgress && renderProgressBar()}

        {extractedResult && renderResult()}

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

        {extractedResult && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full ${isMobile ? "py-2.5 px-3 text-sm" : "py-3 px-4"} bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isSaving ? (
              <>
                <Loader2
                  className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} animate-spin`}
                />
                {t("literatureExtract.saving")}
              </>
            ) : (
              <>
                <CheckCircle2
                  className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`}
                />
                {t("literatureExtract.saveToGraph")}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiteratureExtractPanel;
