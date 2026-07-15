import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  BookOpen,
  Newspaper,
  BarChart3,
  Globe,
  Edit3,
  Trash2,
  Calendar,
  Users,
  Bookmark,
  Link,
  Tag,
  FileType,
  Copy,
  Check,
} from "lucide-react";
import type {
  LiteratureMetadata,
  LiteratureType,
} from "./LiteratureMetadataForm";
import { copyToClipboard } from "@/utils/clipboard";

export interface LiteratureMetadataCardProps {
  metadata: LiteratureMetadata;
  onEdit?: () => void;
  onDelete?: () => void;
  isDark: boolean;
  compact?: boolean;
}

const LITERATURE_TYPE_CONFIG: Record<
  LiteratureType,
  { icon: React.ElementType; color: string }
> = {
  paper: { icon: FileText, color: "#3B82F6" },
  book: { icon: BookOpen, color: "#EF4444" },
  article: { icon: Newspaper, color: "#10B981" },
  report: { icon: BarChart3, color: "#F59E0B" },
  webpage: { icon: Globe, color: "#8B5CF6" },
  document: { icon: FileType, color: "#6366F1" },
};

const LiteratureMetadataCard: React.FC<LiteratureMetadataCardProps> = ({
  metadata,
  onEdit,
  onDelete,
  isDark,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const typeConfig = LITERATURE_TYPE_CONFIG[metadata.type];
  const TypeIcon = typeConfig.icon;
  const typeColor = typeConfig.color;

  const formatCitationText = (): string => {
    const parts: string[] = [];

    if (metadata.authors.length > 0) {
      parts.push(metadata.authors.join(", "));
    }

    if (metadata.year) {
      parts.push(`(${metadata.year})`);
    }

    if (metadata.title) {
      parts.push(metadata.title);
    }

    if (metadata.journal) {
      parts.push(metadata.journal);
    }

    if (metadata.doi) {
      parts.push(`DOI: ${metadata.doi}`);
    }

    return parts.join(". ") + (parts.length > 0 ? "." : "");
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(formatCitationText(), t("common.copied"));
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAuthors = (authors: string[]): string => {
    if (authors.length === 0) return "";
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors[0]} et al.`;
  };

  const formatDoiUrl = (doi: string): string => {
    if (doi.startsWith("http")) return doi;
    return `https://doi.org/${doi}`;
  };

  const renderCompactView = () => (
    <div
      className="group/compact relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
          isDark
            ? "border-slate-700 bg-slate-800/50 hover:bg-slate-700/50"
            : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
      >
        <TypeIcon size={16} style={{ color: typeColor }} />
        <span
          className={`font-medium text-sm truncate ${
            isDark ? "text-slate-100" : "text-gray-900"
          }`}
        >
          {metadata.title}
        </span>
        {metadata.authors.length > 0 && (
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

        {(onEdit || onDelete) && (
          <div
            className={`flex items-center gap-1 transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`p-1 rounded transition-colors ${
                copied
                  ? isDark
                    ? "bg-green-900/30 text-green-400"
                    : "bg-green-50 text-green-500"
                  : isDark
                    ? "hover:bg-slate-600 text-slate-400 hover:text-slate-300"
                    : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              title={copied ? t("common.copied") : t("common.copy.label")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className={`p-1 rounded transition-colors ${
                  isDark
                    ? "hover:bg-slate-600 text-slate-400 hover:text-slate-300"
                    : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                }`}
                title={t("common.edit")}
              >
                <Edit3 size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`p-1 rounded transition-colors ${
                  isDark
                    ? "hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                    : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                }`}
                title={t("common.delete")}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {isHovered && (
        <div
          className={`absolute left-0 right-0 top-full z-50 p-3 rounded-lg border shadow-lg mt-1 ${
            isDark
              ? "border-slate-700 bg-slate-800"
              : "border-gray-200 bg-white"
          }`}
        >
          {renderFullContent()}
        </div>
      )}
    </div>
  );

  const renderFullContent = () => (
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

      {metadata.authors.length > 0 && (
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
          {t(`literatureExtract.metadata.types.${metadata.type}`)}
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

      {metadata.keywords.length > 0 && (
        <div className="flex items-start gap-1.5">
          <Tag
            size={12}
            className={`flex-shrink-0 mt-0.5 ${isDark ? "text-slate-500" : "text-gray-400"}`}
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
  );

  if (compact) {
    return renderCompactView();
  }

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">{renderFullContent()}</div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-lg transition-colors ${
                copied
                  ? isDark
                    ? "bg-green-900/30 text-green-400"
                    : "bg-green-50 text-green-500"
                  : isDark
                    ? "hover:bg-slate-700 text-slate-400 hover:text-slate-300"
                    : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              }`}
              title={copied ? t("common.copied") : t("common.copy.label")}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            {onEdit && (
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
            {onDelete && (
              <button
                onClick={onDelete}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "hover:bg-red-900/30 text-slate-400 hover:text-red-400"
                    : "hover:bg-red-50 text-gray-400 hover:text-red-500"
                }`}
                title={t("common.delete")}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiteratureMetadataCard;
