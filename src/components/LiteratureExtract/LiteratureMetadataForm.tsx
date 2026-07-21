import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  BookOpen,
  User,
  Calendar,
  FileText,
  Link,
  Tag,
  MessageSquare,
  ClipboardPaste,
  FileText as FileIcon,
  BookOpen as BookIcon,
  Newspaper,
  BarChart3,
  Globe,
  FileType,
  Users,
  Bookmark,
} from "lucide-react";

export type LiteratureType =
  | "paper"
  | "book"
  | "article"
  | "report"
  | "webpage"
  | "document";

export interface LiteratureMetadata {
  title: string;
  authors: string[];
  year?: number;
  type: LiteratureType;
  journal?: string;
  doi?: string;
  keywords: string[];
  notes?: string;
}

interface LiteratureMetadataFormProps {
  metadata: Partial<LiteratureMetadata>;
  onMetadataChange: (metadata: Partial<LiteratureMetadata>) => void;
  onAutoDetect: (citationText: string) => Promise<void>;
  isDetecting: boolean;
  isDark: boolean;
  disabled?: boolean;
}

const LITERATURE_TYPES: { value: LiteratureType; labelKey: string }[] = [
  { value: "paper", labelKey: "literatureExtract.metadata.types.paper" },
  { value: "book", labelKey: "literatureExtract.metadata.types.book" },
  { value: "article", labelKey: "literatureExtract.metadata.types.article" },
  { value: "report", labelKey: "literatureExtract.metadata.types.report" },
  { value: "webpage", labelKey: "literatureExtract.metadata.types.webpage" },
  { value: "document", labelKey: "literatureExtract.metadata.types.document" },
];

const LITERATURE_TYPE_CONFIG: Record<
  LiteratureType,
  { icon: React.ElementType; color: string }
> = {
  paper: { icon: FileIcon, color: "#3B82F6" },
  book: { icon: BookIcon, color: "#EF4444" },
  article: { icon: Newspaper, color: "#10B981" },
  report: { icon: BarChart3, color: "#F59E0B" },
  webpage: { icon: Globe, color: "#8B5CF6" },
  document: { icon: FileType, color: "#6366F1" },
};

const getFieldStatus = (
  metadata: Partial<LiteratureMetadata>,
): { filled: boolean; summary: string } => {
  if (!metadata.title) {
    return { filled: false, summary: "" };
  }

  const parts: string[] = [];
  if (metadata.title) {
    parts.push(metadata.title);
  }
  if (metadata.authors && metadata.authors.length > 0) {
    parts.push(
      metadata.authors[0] + (metadata.authors.length > 1 ? " et al." : ""),
    );
  }
  if (metadata.year) {
    parts.push(`(${metadata.year})`);
  }

  return {
    filled: true,
    summary: parts.join(" - "),
  };
};

export const LiteratureMetadataForm: React.FC<LiteratureMetadataFormProps> = ({
  metadata,
  onMetadataChange,
  onAutoDetect,
  isDetecting,
  isDark,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [citationText, setCitationText] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [yearInput, setYearInput] = useState<string>(
    metadata.year?.toString() ?? "",
  );
  const [yearError, setYearError] = useState<string>("");

  useEffect(() => {
    setYearInput(metadata.year?.toString() ?? "");
  }, [metadata.year]);

  const status = getFieldStatus(metadata);

  const handleFieldChange = useCallback(
    <K extends keyof LiteratureMetadata>(
      field: K,
      value: LiteratureMetadata[K],
    ) => {
      onMetadataChange({
        ...metadata,
        [field]: value,
      });
    },
    [metadata, onMetadataChange],
  );

  const handleAuthorsChange = useCallback(
    (value: string) => {
      const authors = value
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      handleFieldChange("authors", authors);
    },
    [handleFieldChange],
  );

  const handleKeywordsChange = useCallback(
    (value: string) => {
      const keywords = value
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      handleFieldChange("keywords", keywords);
    },
    [handleFieldChange],
  );

  const handleYearChange = useCallback(
    (value: string) => {
      setYearInput(value);
      if (!value) {
        setYearError("");
        handleFieldChange("year", undefined);
        return;
      }
      if (/^\d{4}$/.test(value)) {
        setYearError("");
        handleFieldChange("year", parseInt(value, 10));
      } else {
        setYearError(t("form.validation.yearInvalid"));
      }
    },
    [handleFieldChange, t],
  );

  const handleYearBlur = useCallback(() => {
    if (yearInput && !/^\d{4}$/.test(yearInput)) {
      setYearError(t("form.validation.yearInvalid"));
    }
  }, [yearInput, t]);

  const handleAutoDetect = useCallback(async () => {
    if (!citationText.trim()) {
      return;
    }
    await onAutoDetect(citationText.trim());
  }, [citationText, onAutoDetect]);

  const formatAuthors = (authors: string[]): string => {
    if (authors.length === 0) return "";
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors[0]} et al.`;
  };

  const formatDoiUrl = (doi: string): string => {
    if (!doi) return "";
    if (doi.startsWith("http")) return doi;
    return `https://doi.org/${doi}`;
  };

  const renderDetailPopup = () => {
    const typeConfig = LITERATURE_TYPE_CONFIG[metadata.type || "document"];
    const TypeIcon = typeConfig.icon;
    const typeColor = typeConfig.color;

    return (
      <div
        className={`
          absolute left-0 right-0 top-full mt-1 z-50 p-3 rounded-lg border shadow-lg
          ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          }
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <TypeIcon
              size={18}
              style={{ color: typeColor }}
              className="flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <h4
                className={`font-semibold text-sm ${
                  isDark ? "text-slate-100" : "text-gray-900"
                }`}
              >
                {metadata.title}
              </h4>
            </div>
          </div>

          {metadata.authors && metadata.authors.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Users
                size={12}
                className={isDark ? "text-slate-500" : "text-gray-400"}
              />
              <span className={isDark ? "text-slate-400" : "text-gray-600"}>
                {metadata.authors.join(", ")}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap text-xs">
            {metadata.year && (
              <div className="flex items-center gap-1">
                <Calendar
                  size={12}
                  className={isDark ? "text-slate-500" : "text-gray-400"}
                />
                <span className={isDark ? "text-slate-400" : "text-gray-600"}>
                  {metadata.year}
                </span>
              </div>
            )}

            {metadata.journal && (
              <div className="flex items-center gap-1">
                <Bookmark
                  size={12}
                  className={isDark ? "text-slate-500" : "text-gray-400"}
                />
                <span className={isDark ? "text-slate-400" : "text-gray-600"}>
                  {metadata.journal}
                </span>
              </div>
            )}

            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${typeColor}20`,
                color: typeColor,
              }}
            >
              {t(
                `literatureExtract.metadata.types.${metadata.type || "document"}`,
              )}
            </span>
          </div>

          {metadata.doi && (
            <div className="flex items-center gap-1.5 text-xs">
              <Link
                size={12}
                className={isDark ? "text-slate-500" : "text-gray-400"}
              />
              <a
                href={formatDoiUrl(metadata.doi)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:text-primary-600 hover:underline truncate"
              >
                {metadata.doi}
              </a>
            </div>
          )}

          {metadata.keywords && metadata.keywords.length > 0 && (
            <div className="flex items-start gap-1.5">
              <Tag
                size={12}
                className={`flex-shrink-0 mt-0.5 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <div className="flex flex-wrap gap-1">
                {metadata.keywords.slice(0, 5).map((keyword, index) => (
                  <span
                    key={index}
                    className={`px-2 py-0.5 text-xs rounded ${
                      isDark
                        ? "bg-slate-700 text-slate-300"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {keyword}
                  </span>
                ))}
                {metadata.keywords.length > 5 && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    +{metadata.keywords.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCollapsedHeader = () => {
    if (!status.filled) {
      return (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 border-dashed transition-all duration-200
            ${
              isDark
                ? "border-slate-600 bg-slate-800/30 hover:bg-slate-700/40 hover:border-slate-500"
                : "border-gray-300 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-400"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group"}
          `}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`
                p-1.5 rounded-md transition-colors
                ${
                  isDark
                    ? "bg-slate-700 group-hover:bg-slate-600"
                    : "bg-gray-200 group-hover:bg-gray-300"
                }
              `}
            >
              <FileIcon
                size={16}
                className={
                  isDark ? "text-slate-400" : "text-gray-500"
                }
              />
            </div>
            <div className="flex flex-col items-start gap-0.5">
              <span
                className={`text-sm font-medium ${
                  isDark ? "text-slate-300" : "text-gray-700"
                }`}
              >
                {t("literatureExtract.metadata.noSource")}
              </span>
              <span
                className={`text-xs ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              >
                {t("literatureExtract.metadata.addSourceHint")}
              </span>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`transition-transform ${
              isDark ? "text-slate-500" : "text-gray-400"
            } ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      );
    }

    const typeConfig = LITERATURE_TYPE_CONFIG[metadata.type || "document"];
    const TypeIcon = typeConfig.icon;
    const typeColor = typeConfig.color;

    return (
      <div
        className={`
          group relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer
          ${
            isDark
              ? "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50"
              : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
        onMouseEnter={() => !disabled && setIsHovered(true)}
        onMouseLeave={() => !disabled && setIsHovered(false)}
      >
        <TypeIcon size={16} style={{ color: typeColor }} />
        <span
          className={`font-medium text-sm truncate flex-1 ${
            isDark ? "text-slate-100" : "text-gray-900"
          }`}
        >
          {metadata.title}
        </span>
        {metadata.authors && metadata.authors.length > 0 && (
          <span
            className={`text-xs truncate ${
              isDark ? "text-slate-400" : "text-gray-500"
            }`}
          >
            {formatAuthors(metadata.authors)}
          </span>
        )}
        {metadata.year && (
          <span
            className={`text-xs flex-shrink-0 ${
              isDark ? "text-slate-500" : "text-gray-400"
            }`}
          >
            ({metadata.year})
          </span>
        )}
        {isExpanded ? (
          <ChevronUp
            size={16}
            className={isDark ? "text-gray-400" : "text-gray-500"}
          />
        ) : (
          <ChevronDown
            size={16}
            className={isDark ? "text-gray-400" : "text-gray-500"}
          />
        )}
        {isHovered && !isExpanded && renderDetailPopup()}
      </div>
    );
  };

  const renderFormField = (
    labelKey: string,
    icon: React.ElementType,
    children: React.ReactNode,
    hintKey?: string,
    error?: string,
  ) => {
    const Icon = icon;
    return (
      <div className="space-y-1.5">
        <label
          className={`flex items-center gap-1.5 text-sm font-medium ${
            isDark ? "text-gray-300" : "text-gray-700"
          }`}
        >
          <Icon
            size={14}
            className={isDark ? "text-gray-400" : "text-gray-500"}
          />
          {t(labelKey)}
        </label>
        {children}
        {error ? (
          <p
            role="alert"
            className="text-xs text-red-500 dark:text-red-400"
          >
            {error}
          </p>
        ) : (
          hintKey && (
            <p
              className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              {t(hintKey)}
            </p>
          )
        )}
      </div>
    );
  };

  const renderExpandedForm = () => (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div
        className={`
          mt-2 p-4 rounded-lg border space-y-4
          ${isDark ? "border-gray-700 bg-slate-800/30" : "border-gray-200 bg-white"}
        `}
      >
        <div className="pb-3 border-b border-dashed border-gray-300 dark:border-gray-600">
          <label
            className={`flex items-center gap-1.5 text-sm font-medium mb-2 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            <ClipboardPaste
              size={14}
              className={isDark ? "text-gray-400" : "text-gray-500"}
            />
            {t("literatureExtract.metadata.citationInput")}
          </label>
          <textarea
            value={citationText}
            onChange={(e) => setCitationText(e.target.value)}
            placeholder={t("literatureExtract.metadata.citationPlaceholder")}
            disabled={disabled || isDetecting}
            rows={2}
            className={`
              w-full px-3 py-2 text-sm border rounded-lg transition-colors resize-none
              ${
                isDark
                  ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
              }
              ${disabled || isDetecting ? "opacity-50 cursor-not-allowed" : ""}
            `}
          />
          <div className="flex items-center justify-between mt-2">
            <p
              className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              {t("literatureExtract.metadata.citationHint")}
            </p>
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting || disabled || !citationText.trim()}
              className={`
                flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-all
                ${
                  isDark
                    ? "bg-primary-600 hover:bg-primary-700 text-white disabled:bg-slate-600"
                    : "bg-primary-500 hover:bg-primary-600 text-white disabled:bg-gray-300"
                }
                ${isDetecting || disabled || !citationText.trim() ? "opacity-50 cursor-not-allowed" : ""}
              `}
              title={t("literatureExtract.metadata.autoDetect")}
            >
              {isDetecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>{t("literatureExtract.metadata.autoDetect")}</span>
            </button>
          </div>
        </div>

        <div className="pt-1">
          <div className="flex items-center justify-between mb-3">
            <span
              className={`text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}
            >
              {t("literatureExtract.metadata.manualEdit")}
            </span>
          </div>

          {renderFormField(
            "literatureExtract.metadata.fields.title",
            FileText,
            <input
              type="text"
              value={metadata.title || ""}
              onChange={(e) => handleFieldChange("title", e.target.value)}
              placeholder={t("literatureExtract.metadata.placeholders.title")}
              disabled={disabled}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
          )}

          {renderFormField(
            "literatureExtract.metadata.fields.authors",
            User,
            <input
              type="text"
              value={metadata.authors?.join(", ") || ""}
              onChange={(e) => handleAuthorsChange(e.target.value)}
              placeholder={t("literatureExtract.metadata.placeholders.authors")}
              disabled={disabled}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
            "literatureExtract.metadata.hints.authors",
          )}

          <div className="grid grid-cols-2 gap-4">
            {renderFormField(
              "literatureExtract.metadata.fields.year",
              Calendar,
              <input
                type="text"
                inputMode="numeric"
                value={yearInput}
                onChange={(e) => handleYearChange(e.target.value)}
                onBlur={handleYearBlur}
                placeholder={t("literatureExtract.metadata.placeholders.year")}
                disabled={disabled}
                aria-invalid={!!yearError}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg transition-colors
                  ${
                    yearError
                      ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : isDark
                        ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              />,
              undefined,
              yearError,
            )}

            {renderFormField(
              "literatureExtract.metadata.fields.type",
              FileText,
              <select
                value={metadata.type || "paper"}
                onChange={(e) =>
                  handleFieldChange("type", e.target.value as LiteratureType)
                }
                disabled={disabled}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg transition-colors
                  ${
                    isDark
                      ? "border-gray-600 bg-slate-700 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {LITERATURE_TYPES.map(({ value, labelKey }) => (
                  <option key={value} value={value}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>,
            )}
          </div>

          {renderFormField(
            "literatureExtract.metadata.fields.journal",
            BookOpen,
            <input
              type="text"
              value={metadata.journal || ""}
              onChange={(e) => handleFieldChange("journal", e.target.value)}
              placeholder={t("literatureExtract.metadata.placeholders.journal")}
              disabled={disabled}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
          )}

          {renderFormField(
            "literatureExtract.metadata.fields.doi",
            Link,
            <input
              type="text"
              value={metadata.doi || ""}
              onChange={(e) => handleFieldChange("doi", e.target.value)}
              placeholder={t("literatureExtract.metadata.placeholders.doi")}
              disabled={disabled}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
          )}

          {renderFormField(
            "literatureExtract.metadata.fields.keywords",
            Tag,
            <input
              type="text"
              value={metadata.keywords?.join(", ") || ""}
              onChange={(e) => handleKeywordsChange(e.target.value)}
              placeholder={t(
                "literatureExtract.metadata.placeholders.keywords",
              )}
              disabled={disabled}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
            "literatureExtract.metadata.hints.keywords",
          )}

          {renderFormField(
            "literatureExtract.metadata.fields.notes",
            MessageSquare,
            <textarea
              value={metadata.notes || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder={t("literatureExtract.metadata.placeholders.notes")}
              disabled={disabled}
              rows={3}
              className={`
                w-full px-3 py-2 text-sm border rounded-lg transition-colors resize-none
                ${
                  isDark
                    ? "border-gray-600 bg-slate-700 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-100 dark:placeholder-slate-500"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              `}
            />,
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="literature-metadata-form">
      {renderCollapsedHeader()}
      <AnimatePresence>{isExpanded && renderExpandedForm()}</AnimatePresence>
    </div>
  );
};

export default LiteratureMetadataForm;
