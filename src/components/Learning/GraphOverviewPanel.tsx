import React from "react";
import {
  BookOpen,
  ExternalLink,
  Edit3,
  FileText,
  Video,
  GraduationCap,
  Wrench,
  Link as LinkIcon,
  Info,
  BookMarked,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Graph, ReferenceBook, ExternalLink as ExternalLinkType } from "../../../shared/types/graph";

interface GraphOverviewPanelProps {
  graph: Graph | null;
  onEdit?: () => void;
}

const getExternalLinkIcon = (type: string) => {
  switch (type) {
    case "article":
      return FileText;
    case "video":
      return Video;
    case "course":
      return GraduationCap;
    case "tool":
      return Wrench;
    default:
      return LinkIcon;
  }
};

const getExternalLinkTypeLabel = (type: string) => {
  switch (type) {
    case "article":
      return "文章";
    case "video":
      return "视频";
    case "course":
      return "课程";
    case "tool":
      return "工具";
    default:
      return "链接";
  }
};

export const GraphOverviewPanel: React.FC<GraphOverviewPanelProps> = ({
  graph,
  onEdit,
}) => {
  if (!graph) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <Info className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" />
        <p className="text-sm">请先选择一个知识图谱</p>
      </div>
    );
  }

  const hasContent = 
    graph.description || 
    (graph.reference_books && graph.reference_books.length > 0) || 
    (graph.external_links && graph.external_links.length > 0) || 
    graph.learning_guide;

  return (
    <div className="graph-overview-panel h-full w-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              图谱概览
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {graph.title}
            </p>
          </div>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Edit3 size={14} />
            编辑
          </button>
        )}
      </div>

      {!hasContent ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <BookMarked className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            暂无详细信息
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            添加描述、参考书籍、外部链接和学习指南，帮助更好地理解这个知识图谱
          </p>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg text-sm hover:from-indigo-600 hover:to-purple-600 flex items-center gap-2 mx-auto"
            >
              <Edit3 className="w-4 h-4" />
              添加信息
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          {graph.description && (
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  描述
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {graph.description}
              </p>
            </div>
          )}

          {graph.reference_books && graph.reference_books.length > 0 && (
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookMarked className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  参考书籍
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({graph.reference_books.length})
                </span>
              </div>
              <div className="space-y-3">
                {graph.reference_books.map((book: ReferenceBook, index: number) => (
                  <div
                    key={index}
                    className="border-l-2 border-indigo-200 dark:border-indigo-700 pl-3 py-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {book.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          作者：{book.author}
                        </p>
                        {book.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                            {book.description}
                          </p>
                        )}
                      </div>
                      {book.url && (
                        <a
                          href={book.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-1.5 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded hover:bg-gray-100 dark:hover:bg-slate-600"
                          title="查看链接"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {book.isbn && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        ISBN: {book.isbn}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {graph.external_links && graph.external_links.length > 0 && (
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  外部链接
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({graph.external_links.length})
                </span>
              </div>
              <div className="space-y-2">
                {graph.external_links.map((link: ExternalLinkType, index: number) => {
                  const LinkIcon = getExternalLinkIcon(link.type);
                  return (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors group"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <LinkIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {link.title}
                          </span>
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300 rounded">
                            {getExternalLinkTypeLabel(link.type)}
                          </span>
                        </div>
                        {link.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {link.description}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 dark:text-gray-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {graph.learning_guide && (
            <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  学习指南
                </h3>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-base font-bold text-gray-900 dark:text-white mb-2 mt-3 first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2 mt-3 first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 mt-2 first:mt-0">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm leading-relaxed mb-2 last:mb-0">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside text-sm space-y-1 mb-2 last:mb-0">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside text-sm space-y-1 mb-2 last:mb-0">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-gray-600 dark:text-gray-300">
                        {children}
                      </li>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ className, children }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-slate-600 rounded text-xs font-mono">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="block p-2 bg-gray-100 dark:bg-slate-600 rounded text-xs font-mono overflow-x-auto">
                          {children}
                        </code>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 my-2 text-gray-600 dark:text-gray-300 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {graph.learning_guide}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphOverviewPanel;
