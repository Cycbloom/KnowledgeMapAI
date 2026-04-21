import React from 'react';
import { Send, Loader2, Lightbulb, Sparkles } from 'lucide-react';

interface ChatInputProps {
  input: string;
  isDark: boolean;
  isTutorMode: boolean;
  isLoading: boolean;
  selectedNodeCount: number;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onExtractConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  hasAssistantMessages: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  isDark,
  isTutorMode,
  isLoading,
  selectedNodeCount,
  onInputChange,
  onKeyDown,
  onSend,
  onExtractConcepts,
  onSuggestNextTopics,
  hasAssistantMessages
}) => {
  return (
    <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
      {selectedNodeCount > 0 && (
        <div className={`mb-2 text-xs px-2 py-1 rounded inline-block ${
          isTutorMode 
            ? isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-600'
            : isDark ? 'bg-primary-900/30 text-primary-300' : 'bg-primary-50 text-primary-600'
        }`}>
          已选中 {selectedNodeCount} 个节点作为上下文
        </div>
      )}
      <div className={`flex items-end gap-2 p-2 rounded-2xl ${
        isDark ? 'bg-slate-800' : 'bg-gray-100'
      }`}>
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isTutorMode ? "与助教对话..." : "输入你的问题..."}
          rows={1}
          className={`flex-1 bg-transparent resize-none outline-none text-sm ${
            isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
          }`}
          style={{ maxHeight: '120px' }}
          disabled={isLoading}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          className={`p-2 rounded-xl transition-all ${
            input.trim() && !isLoading
              ? isTutorMode 
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-primary-600 text-white hover:bg-primary-700'
              : isDark 
                ? 'bg-slate-700 text-slate-500' 
                : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
      
      {isTutorMode && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onExtractConcepts}
            disabled={!hasAssistantMessages}
            className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark 
                ? 'bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50' 
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            <Lightbulb size={14} />
            提取概念
          </button>
          {onSuggestNextTopics && (
            <button
              onClick={onSuggestNextTopics}
              className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                isDark 
                  ? 'bg-primary-900/30 text-primary-300 hover:bg-primary-900/50' 
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              }`}
            >
              <Sparkles size={14} />
              学习建议
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInput;
