import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, FileText, Sparkles, ChevronRight, Clock, Layers, BookOpen, NotebookPen, Hash } from 'lucide-react';
import type { SearchResult, SearchNodeResult } from '../../services/api/search';
import { type SearchNodeNavigateTarget } from '../Settings/GraphEditorSettings';
import { useGraphEditorPreferencesStore } from '../../store/useGraphEditorPreferencesStore';
import { formatDate } from '@/utils/formatters';

/** Get the node ID from a search result, handling both keyword (id) and semantic (knowledge_point_id) formats */
const getNodeId = (node: SearchNodeResult): string =>
  node.knowledge_point_id || node.id || '';

const getDefaultNavigateTarget = (): SearchNodeNavigateTarget => {
  return useGraphEditorPreferencesStore.getState().searchNodeNavigateTarget;
};

/** 标签 chip 颜色(与 NotesListPage 视觉风格一致,只读展示) */
const NOTE_TAG_CHIP_COLORS = [
  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
];

const getNoteTagChipColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NOTE_TAG_CHIP_COLORS[Math.abs(hash) % NOTE_TAG_CHIP_COLORS.length];
};

/** 笔记类型徽章样式:daily 紫色,note 蓝色(对齐 NotesListPage.getTypeBadgeClass) */
const getNoteTypeBadgeClass = (type: string): string => {
  if (type === 'daily') {
    return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
};

/** 前端保险截断:后端已截断 summary 到 200 字符,这里再做一次防御 */
const truncateSummary = (text: string, maxLen = 200): string => {
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
};

/** 只读笔记标签芯片组(用于搜索结果项展示 note.tags) */
const NoteTagChips: React.FC<{ tags: string[] | null | undefined }> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {tags.slice(0, 6).map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getNoteTagChipColor(tag)}`}
        >
          <Hash size={9} aria-hidden="true" />
          {tag}
        </span>
      ))}
      {tags.length > 6 && (
        <span className="text-[10px] text-gray-400 dark:text-slate-500">
          +{tags.length - 6}
        </span>
      )}
    </div>
  );
};

interface SearchResultsProps {
  results: SearchResult | null;
  isSearching: boolean;
  query: string;
  onClose?: () => void;
}

const HighlightText: React.FC<{ text: string; query: string; className?: string }> = ({ 
  text, 
  query, 
  className = '' 
}) => {
  const highlighted = useMemo(() => {
    if (!text || !query.trim()) return text || '';
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) 
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 text-inherit rounded px-0.5">{part}</mark>
        : part
    );
  }, [text, query]);

  return <span className={className}>{highlighted}</span>;
};

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isSearching,
  query,
  onClose,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleGraphClick = useCallback((graphId: string) => {
    navigate(`/graph/${graphId}`);
    onClose?.();
  }, [navigate, onClose]);

  const navigateToNode = useCallback((graphId: string, nodeId: string, target: SearchNodeNavigateTarget) => {
    if (target === 'learning') {
      navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`);
    } else {
      navigate(`/graph/${graphId}?node_id=${nodeId}`);
    }
    onClose?.();
  }, [navigate, onClose]);

  const handleNodeMainClick = useCallback((graphId: string, nodeId: string) => {
    const target = getDefaultNavigateTarget();
    navigateToNode(graphId, nodeId, target);
  }, [navigateToNode]);

  const handleNoteClick = useCallback((noteId: string) => {
    navigate(`/notes/${noteId}`);
    onClose?.();
  }, [navigate, onClose]);

  const hasResults = results && (
    results.graphs.length > 0 ||
    results.nodes.length > 0 ||
    (results.notes?.length ?? 0) > 0
  );

  if (isSearching) {
    return (
      <div role="status" className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 z-50 p-3">
        <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
          <span>搜索中...</span>
        </div>
      </div>
    );
  }

  if (!results && query.length >= 2) {
    return null;
  }

  if (!hasResults && query.length >= 2) {
    return (
      <div role="status" className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 z-50 p-3">
        <div className="text-center text-gray-500 dark:text-gray-400 text-sm">
          未找到「{query}」相关结果
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 z-50 max-h-[60vh] overflow-y-auto"
      >
        {results?.graphs && results.graphs.length > 0 && (
          <div className="py-1.5 border-b border-gray-200 dark:border-slate-500">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <Network className="w-3 h-3 text-primary-500" />
              <span aria-live="polite" aria-atomic="true">图谱 {results.graphs.length}</span>
            </div>
            <div>
              {results.graphs.map((graph) => (
                <button
                  key={graph.id}
                  onClick={() => handleGraphClick(graph.id)}
                  className="w-full px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left flex items-center gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HighlightText 
                        text={graph.title} 
                        query={query} 
                        className="text-sm text-gray-900 dark:text-white truncate font-medium"
                      />
                      {graph.similarity !== undefined && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
                          {(graph.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {graph.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        <HighlightText text={graph.description} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {graph.nodes_count !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Layers className="w-2.5 h-2.5" />
                          {graph.nodes_count}
                        </span>
                      )}
                      {graph.updated_at && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(graph.updated_at, 'short')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {results?.nodes && results.nodes.length > 0 && (
          <div className="py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <FileText className="w-3 h-3 text-green-500" />
              <span aria-live="polite" aria-atomic="true">节点 {results.nodes.length}</span>
            </div>
            <div>
              {results.nodes.map((node, index) => (
                <div
                  key={`${getNodeId(node)}-${index}`}
                  className="w-full px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2 group"
                >
                  <button
                    onClick={() => handleNodeMainClick(node.graph_id, getNodeId(node))}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <HighlightText 
                        text={node.title} 
                        query={query} 
                        className="text-sm text-gray-900 dark:text-white truncate font-medium"
                      />
                      {node.similarity !== undefined && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300">
                          {(node.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {(node.summary || node.content) && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        <HighlightText text={node.summary || node.content || ''} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      <span className="flex items-center gap-0.5 truncate">
                        <Network className="w-2.5 h-2.5 flex-shrink-0" />
                        <HighlightText text={node.graph_title || ''} query={query} />
                      </span>
                      {node.updated_at && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(node.updated_at, 'short')}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToNode(node.graph_id, getNodeId(node), 'graph');
                      }}
                      className="p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/30 text-gray-400 hover:text-primary-500 transition-colors"
                      title={t('dashboard.search.navigateToGraph')}
                      aria-label={t('dashboard.search.navigateToGraph')}
                    >
                      <Network className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToNode(node.graph_id, getNodeId(node), 'learning');
                      }}
                      className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-500 transition-colors"
                      title={t('dashboard.search.navigateToLearning')}
                      aria-label={t('dashboard.search.navigateToLearning')}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results?.notes && results.notes.length > 0 && (
          <div className="py-1.5 border-t border-gray-200 dark:border-slate-500">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <NotebookPen className="w-3 h-3 text-amber-500" />
              <span aria-live="polite" aria-atomic="true">
                {t('dashboard.search.notes')} {results.notes.length}
              </span>
            </div>
            <div>
              {results.notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleNoteClick(note.id)}
                  className="w-full px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left flex items-center gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <HighlightText
                        text={note.title}
                        query={query}
                        className="text-sm text-gray-900 dark:text-white truncate font-bold"
                      />
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded border ${getNoteTypeBadgeClass(note.type)}`}
                      >
                        {note.type === 'daily'
                          ? t('dashboard.search.noteBadgeDaily')
                          : t('dashboard.search.noteBadgeNote')}
                      </span>
                      {note.similarity !== undefined && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300">
                          {(note.similarity * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {note.summary && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                        <HighlightText text={truncateSummary(note.summary)} query={query} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {note.updated_at && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDate(note.updated_at, 'short')}
                        </span>
                      )}
                    </div>
                    <NoteTagChips tags={note.tags} />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {results?.answer && (
          <div className="p-2 border-t border-gray-200 dark:border-slate-500 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-primary-500" />
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">AI 回答</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">{results.answer}</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
