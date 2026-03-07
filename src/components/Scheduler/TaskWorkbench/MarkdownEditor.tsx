import React, { useState, useEffect, useCallback } from 'react';
import { Save, Eye, Edit3, Maximize2, Minimize2 } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  placeholder = '在这里记录任务笔记...',
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleSave = useCallback(async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(localValue);
      } finally {
        setIsSaving(false);
      }
    }
  }, [onSave, localValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const renderPreview = () => {
    const lines = localValue.split('\n');
    return (
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {lines.map((line, index) => {
          if (line.startsWith('### ')) {
            return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
          }
          if (line.startsWith('# ')) {
            return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
          }
          if (line.startsWith('- ')) {
            return <li key={index} className="ml-4">{line.slice(2)}</li>;
          }
          if (line.startsWith('* ') || line.startsWith('- ')) {
            return <li key={index} className="ml-4">{line.slice(2)}</li>;
          }
          if (line.startsWith('```')) {
            return null;
          }
          if (line.trim() === '') {
            return <br key={index} />;
          }
          let processedLine = line;
          processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          processedLine = processedLine.replace(/\*(.+?)\*/g, '<em>$1</em>');
          processedLine = processedLine.replace(/`(.+?)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded">$1</code>');
          processedLine = processedLine.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-cyan-500 hover:underline" target="_blank">$1</a>');
          
          return <p key={index} dangerouslySetInnerHTML={{ __html: processedLine }} />;
        })}
      </div>
    );
  };

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900'
    : '';

  return (
    <div className={`flex flex-col h-full ${containerClass} ${className}`}>
      <div className={`flex flex-col h-full ${isFullscreen ? 'p-4' : ''}`}>
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isEditing
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Edit3 size={14} className="inline mr-1" />
              编辑
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !isEditing
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Eye size={14} className="inline mr-1" />
              预览
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onSave && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 transition-all"
              >
                <Save size={14} />
                {isSaving ? '保存中...' : '保存'}
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {isEditing ? (
            <textarea
              value={localValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full h-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400"
            />
          ) : (
            <div className="h-full overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              {localValue ? renderPreview() : (
                <p className="text-slate-400 dark:text-slate-500 italic">暂无内容</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          支持 Markdown 语法：**粗体** *斜体* `代码` [链接](url) # 标题 - 列表
        </div>
      </div>
    </div>
  );
};
