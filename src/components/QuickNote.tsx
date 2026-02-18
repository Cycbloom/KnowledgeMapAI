import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, Lightbulb, Link2, Tag, Save, Plus, Search, Loader2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { Node } from '../types';
import { TagInput } from './TagSystem';

interface QuickNote {
  id: string;
  content: string;
  tags: string[];
  linkedNodeId?: string;
  linkedNodeTitle?: string;
  createdAt: number;
}

interface QuickNotePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  onSave: (note: Omit<QuickNote, 'id' | 'createdAt'>) => void;
  onConvertToNode?: (note: QuickNote) => void;
}

const QUICK_NOTES_KEY = 'knowledgeMap_quickNotes';

export const loadQuickNotes = (): QuickNote[] => {
  try {
    const stored = localStorage.getItem(QUICK_NOTES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const saveQuickNotes = (notes: QuickNote[]) => {
  try {
    localStorage.setItem(QUICK_NOTES_KEY, JSON.stringify(notes));
  } catch {
    console.error('Failed to save quick notes');
  }
};

export const QuickNotePanel: React.FC<QuickNotePanelProps> = ({
  isOpen,
  onClose,
  nodes,
  onSave,
  onConvertToNode
}) => {
  const { isDark } = useTheme();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [linkedNodeId, setLinkedNodeId] = useState<string | undefined>();
  const [showNodeSearch, setShowNodeSearch] = useState(false);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (!isOpen) {
          setContent('');
          setTags([]);
          setLinkedNodeId(undefined);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredNodes = React.useMemo(() => {
    if (!nodeSearchQuery.trim()) return nodes.slice(0, 10);
    const query = nodeSearchQuery.toLowerCase();
    return nodes
      .filter(n => n.title.toLowerCase().includes(query))
      .slice(0, 10);
  }, [nodes, nodeSearchQuery]);

  const linkedNode = React.useMemo(() => {
    return nodes.find(n => n.id === linkedNodeId);
  }, [nodes, linkedNodeId]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    
    setSaving(true);
    try {
      await onSave({
        content: content.trim(),
        tags,
        linkedNodeId,
        linkedNodeTitle: linkedNode?.title
      });
      
      setContent('');
      setTags([]);
      setLinkedNodeId(undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [content, tags, linkedNodeId, linkedNode, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`
        relative w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden
        animate-in fade-in zoom-in-95 duration-200
        ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}
      `}>
        <div className={`
          flex items-center justify-between px-4 py-3 border-b
          ${isDark ? 'border-slate-700' : 'border-gray-100'}
        `}>
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-500" />
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
              快速笔记
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="记录你的想法..."
            rows={4}
            className={`
              w-full p-3 rounded-xl border resize-none outline-none
              transition-all focus:ring-2 focus:ring-blue-500
              ${isDark 
                ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}
            `}
          />

          <div>
            <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-gray-700'
            }`}>
              <Tag size={14} />
              标签
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="添加标签..."
              suggestions={nodes.flatMap(n => n.tags || []).filter((t, i, arr) => arr.indexOf(t) === i)}
            />
          </div>

          <div>
            <label className={`flex items-center gap-2 text-sm font-medium mb-2 ${
              isDark ? 'text-slate-300' : 'text-gray-700'
            }`}>
              <Link2 size={14} />
              关联节点
            </label>
            
            {linkedNode ? (
              <div className={`
                flex items-center justify-between p-3 rounded-xl border
                ${isDark ? 'border-slate-600 bg-slate-700/50' : 'border-gray-200 bg-gray-50'}
              `}>
                <span className={`truncate ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                  {linkedNode.title}
                </span>
                <button
                  onClick={() => setLinkedNodeId(undefined)}
                  className={`p-1 rounded-lg ${
                    isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-gray-200 text-gray-500'
                  }`}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowNodeSearch(!showNodeSearch)}
                  className={`
                    w-full text-left p-3 rounded-xl border transition-colors
                    ${isDark 
                      ? 'border-slate-600 hover:border-slate-500 text-slate-400' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-500'}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <Search size={14} />
                    点击选择要关联的节点...
                  </span>
                </button>

                {showNodeSearch && (
                  <div className={`
                    absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl border z-10
                    max-h-48 overflow-y-auto
                    ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-200'}
                  `}>
                    <div className="p-2">
                      <input
                        type="text"
                        value={nodeSearchQuery}
                        onChange={(e) => setNodeSearchQuery(e.target.value)}
                        placeholder="搜索节点..."
                        className={`
                          w-full px-3 py-2 rounded-lg text-sm outline-none
                          ${isDark 
                            ? 'bg-slate-600 text-white placeholder-slate-400' 
                            : 'bg-gray-100 text-gray-800 placeholder-gray-400'}
                        `}
                      />
                    </div>
                    
                    {filteredNodes.map(node => (
                      <button
                        key={node.id}
                        onClick={() => {
                          setLinkedNodeId(node.id);
                          setShowNodeSearch(false);
                          setNodeSearchQuery('');
                        }}
                        className={`
                          w-full text-left px-3 py-2 text-sm transition-colors
                          ${isDark ? 'hover:bg-slate-600 text-slate-200' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                      >
                        {node.title}
                      </button>
                    ))}
                    
                    {filteredNodes.length === 0 && (
                      <div className={`px-3 py-4 text-center text-sm ${
                        isDark ? 'text-slate-400' : 'text-gray-500'
                      }`}>
                        未找到匹配的节点
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`
          flex items-center justify-between px-4 py-3 border-t
          ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50'}
        `}>
          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            Ctrl+Enter 保存 · Esc 关闭
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${isDark 
                  ? 'text-slate-300 hover:bg-slate-700' 
                  : 'text-gray-600 hover:bg-gray-200'}
              `}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-all
                ${content.trim() && !saving
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25'
                  : isDark 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
              `}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const QuickNoteButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  const { isDark } = useTheme();

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-40
        p-4 rounded-full shadow-lg
        transition-all hover:scale-110
        bg-amber-500 text-white
        hover:bg-amber-600
      `}
      title="快速笔记 (Ctrl+N)"
    >
      <Lightbulb size={24} />
    </button>
  );
};

export const QuickNoteList: React.FC<{
  notes: QuickNote[];
  onDelete: (id: string) => void;
  onConvert: (note: QuickNote) => void;
}> = ({ notes, onDelete, onConvert }) => {
  const { isDark } = useTheme();

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (notes.length === 0) {
    return (
      <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        <Lightbulb size={32} className="mx-auto mb-2 opacity-50" />
        <p>暂无快速笔记</p>
        <p className="text-xs mt-1">按 Ctrl+N 快速记录想法</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map(note => (
        <div
          key={note.id}
          className={`
            p-4 rounded-xl border transition-all
            ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-white'}
          `}
        >
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
            {note.content}
          </p>
          
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {note.tags.map(tag => (
                <span
                  key={tag}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {note.linkedNodeTitle && (
            <div className={`flex items-center gap-1.5 mt-2 text-xs ${
              isDark ? 'text-slate-400' : 'text-gray-500'
            }`}>
              <Link2 size={12} />
              <span>关联: {note.linkedNodeTitle}</span>
            </div>
          )}
          
          <div className={`flex items-center justify-between mt-3 pt-3 border-t ${
            isDark ? 'border-slate-700' : 'border-gray-100'
          }`}>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
              {formatDate(note.createdAt)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onConvert(note)}
                className={`
                  text-xs flex items-center gap-1 px-2 py-1 rounded-lg
                  transition-colors
                  ${isDark 
                    ? 'text-blue-400 hover:bg-slate-700' 
                    : 'text-blue-600 hover:bg-blue-50'}
                `}
              >
                <Plus size={12} />
                转为节点
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className={`
                  text-xs flex items-center gap-1 px-2 py-1 rounded-lg
                  transition-colors
                  ${isDark 
                    ? 'text-red-400 hover:bg-slate-700' 
                    : 'text-red-600 hover:bg-red-50'}
                `}
              >
                <X size={12} />
                删除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
