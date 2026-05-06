import React, { useState, useCallback } from "react";
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
      const year = value ? parseInt(value, 10) : undefined;
      if (value && (isNaN(year!) || year! < 1000 || year! > 9999)) {
        return;
      }
      handleFieldChange("year", year);
    },
    [handleFieldChange],
  );

  const handleAutoDetect = useCallback(async () => {
    if (!citationText.trim()) {
      return;
    }
    await onAutoDetect(citationText.trim());
  }, [citationText, onAutoDetect]);

  const renderCollapsedHeader = () => (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      disabled={disabled}
      className={`
        w-full flex items-center justify-between p-3 rounded-lg border transition-all
        ${
          isDark
            ? "border-gray-700 bg-slate-800/50 hover:bg-slate-700/50"
            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      <div className="flex items-center gap-2">
        <BookOpen
          size={16}
          className={isDark ? "text-gray-400" : "text-gray-500"}
        />
        <span
          className={`text-sm font-medium ${
            status.filled
              ? isDark
                ? "text-gray-200"
                : "text-gray-700"
              : isDark
                ? "text-gray-400"
                : "text-gray-500"
          }`}
        >
          {status.filled
            ? t("literatureExtract.metadata.sourceWith", {
                source: status.summary,
              })
            : t("literatureExtract.metadata.noSource")}
        </span>
      </div>
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
    </button>
  );

  const renderFormField = (
    labelKey: string,
    icon: React.ElementType,
    children: React.ReactNode,
    hintKey?: string,
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
        {hintKey && (
          <p
            className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
          >
            {t(hintKey)}
          </p>
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
                  ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                type="number"
                value={metadata.year || ""}
                onChange={(e) => handleYearChange(e.target.value)}
                placeholder={t("literatureExtract.metadata.placeholders.year")}
                disabled={disabled}
                min={1000}
                max={9999}
                className={`
                  w-full px-3 py-2 text-sm border rounded-lg transition-colors
                  ${
                    isDark
                      ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              />,
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
                      : "border-gray-300 bg-white text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
                    ? "border-gray-600 bg-slate-700 text-white placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
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
