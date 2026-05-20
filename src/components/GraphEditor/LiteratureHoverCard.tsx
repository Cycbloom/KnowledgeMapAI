import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Users,
  Link2,
  File,
  BookOpen,
  Hash,
  Quote,
} from "lucide-react";

interface LiteratureHoverCardProps {
  literature: {
    key: string;
    title: string;
    authors?: string[];
    year?: number;
    url?: string;
    fileName?: string;
    type?: string;
    journal?: string;
    doi?: string;
    keywords?: string[];
    abstract?: string;
    nodes: any[];
  };
  position: { x: number; y: number };
  onNodeClick?: (node: any) => void;
  isDark?: boolean;
}

const LITERATURE_TYPE_LABELS: Record<string, string> = {
  paper: "论文",
  book: "书籍",
  article: "文章",
  report: "报告",
  webpage: "网页",
  document: "文档",
};

export const LiteratureHoverCard: React.FC<LiteratureHoverCardProps> = ({
  literature,
  position,
  isDark = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  const formatAuthors = (authors?: string[]): string => {
    if (!authors || authors.length === 0) return "未知作者";
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors[0]} et al.`;
  };

  const formatKeywords = (keywords?: string[]): string | null => {
    if (!keywords || keywords.length === 0) return null;
    return keywords.slice(0, 5).join(" · ");
  };

  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x + 8;
    let adjustedY = position.y;

    // Check right boundary
    if (adjustedX + rect.width > viewportWidth - 16) {
      adjustedX = position.x - rect.width - 8;
    }

    // Check bottom boundary
    if (adjustedY + rect.height > viewportHeight - 16) {
      adjustedY = viewportHeight - rect.height - 16;
    }

    // Ensure not above viewport
    if (adjustedY < 16) {
      adjustedY = 16;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position]);

  return (
    <div
      ref={cardRef}
      className={`fixed z-50 w-80 rounded-lg border shadow-xl transition-opacity duration-200 animate-in fade-in zoom-in-95 ${
        isDark
          ? "border-slate-700 bg-slate-800"
          : "border-gray-200 bg-white"
      }`}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
      }}
    >
      <div className="p-4 space-y-3">
        {/* Header with icon and type badge */}
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? "bg-purple-900/30" : "bg-purple-50"
            }`}
          >
            <FileText size={20} className="text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h4
                className={`font-semibold text-sm leading-tight line-clamp-2 flex-1 ${
                  isDark ? "text-slate-100" : "text-gray-900"
                }`}
              >
                {literature.title}
              </h4>
              {literature.type && (
                <span
                  className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase ${
                    isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {LITERATURE_TYPE_LABELS[literature.type] || literature.type}
                </span>
              )}
            </div>
            {literature.fileName && (
              <div
                className={`flex items-center gap-1 text-[11px] ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              >
                <File size={10} />
                <span className="truncate">{literature.fileName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Section */}
        <div className="space-y-2">
          {/* Authors */}
          {literature.authors && literature.authors.length > 0 && (
            <div className="flex items-start gap-2">
              <Users
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <span
                className={`text-xs leading-relaxed ${
                  isDark ? "text-slate-400" : "text-gray-600"
                }`}
              >
                {formatAuthors(literature.authors)}
              </span>
            </div>
          )}

          {/* Journal and Year */}
          {(literature.journal || literature.year) && (
            <div className="flex items-center gap-2">
              <BookOpen
                size={14}
                className={`flex-shrink-0 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <span
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-gray-600"
                }`}
              >
                {[literature.journal, literature.year].filter(Boolean).join(", ")}
              </span>
            </div>
          )}

          {/* DOI */}
          {literature.doi && (
            <div className="flex items-center gap-2">
              <Hash
                size={14}
                className={`flex-shrink-0 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <a
                href={`https://doi.org/${literature.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs hover:underline transition-colors ${
                  isDark
                    ? "text-purple-400 hover:text-purple-300"
                    : "text-purple-600 hover:text-purple-700"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                DOI: {literature.doi}
              </a>
            </div>
          )}

          {/* URL */}
          {literature.url && !literature.doi && (
            <div className="flex items-start gap-2">
              <Link2
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <a
                href={literature.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs leading-relaxed truncate hover:underline transition-colors ${
                  isDark
                    ? "text-purple-400 hover:text-purple-300"
                    : "text-purple-600 hover:text-purple-700"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {literature.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>
          )}

          {/* Keywords */}
          {formatKeywords(literature.keywords) && (
            <div className="flex items-start gap-2">
              <Hash
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <div className="flex flex-wrap gap-1">
                {literature.keywords?.slice(0, 5).map((keyword, index) => (
                  <span
                    key={index}
                    className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                      isDark
                        ? "bg-slate-700 text-slate-300"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Abstract */}
          {literature.abstract && (
            <div className="flex items-start gap-2 pt-1 border-t border-dashed">
              <Quote
                size={14}
                className={`flex-shrink-0 mt-0.5 ${
                  isDark ? "text-slate-500" : "text-gray-400"
                }`}
              />
              <p
                className={`text-xs leading-relaxed line-clamp-4 italic ${
                  isDark ? "text-slate-400" : "text-gray-600"
                }`}
              >
                {literature.abstract}
              </p>
            </div>
          )}
        </div>

        {/* Footer with node count */}
        {literature.nodes && literature.nodes.length > 0 && (
          <>
            <div
              className={`border-t ${
                isDark ? "border-slate-700" : "border-gray-100"
              }`}
            />
            <div
              className={`flex items-center justify-between text-[11px] ${
                isDark ? "text-slate-500" : "text-gray-400"
              }`}
            >
              <span>已提取概念</span>
              <span
                className={`px-1.5 py-0.5 rounded-full font-medium ${
                  isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {literature.nodes.length} 个
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiteratureHoverCard;
