import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, BookOpen, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message } from './hooks/useChatState';

interface ChatMessageProps {
  message: Message;
  isDark: boolean;
  isTutorMode: boolean;
  onNodeClick?: (nodeId: string) => void;
  voiceControl?: React.ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isDark,
  isTutorMode,
  onNodeClick,
  voiceControl
}) => {
  const renderCodeBlock = ({ className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code 
          className={`px-1.5 py-0.5 rounded text-xs ${
            isDark ? 'bg-slate-700 text-indigo-300' : 'bg-gray-200 text-indigo-600'
          }`} 
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code 
        className={`block p-2 rounded-lg text-xs overflow-x-auto ${
          isDark ? 'bg-slate-900' : 'bg-gray-200'
        }`} 
        {...props}
      >
        {children}
      </code>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        message.role === 'user'
          ? isTutorMode 
            ? isDark ? 'bg-amber-600' : 'bg-amber-500'
            : isDark ? 'bg-indigo-600' : 'bg-indigo-500'
          : isDark ? 'bg-slate-700' : 'bg-gray-200'
      }`}>
        {message.role === 'user' ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className={isTutorMode 
            ? isDark ? 'text-amber-400' : 'text-amber-600'
            : isDark ? 'text-indigo-400' : 'text-indigo-600'
          } />
        )}
      </div>
      
      <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
        <div className={`inline-block p-3 rounded-2xl text-sm ${
          message.role === 'user'
            ? isTutorMode 
              ? 'bg-amber-500 text-white rounded-tr-sm'
              : 'bg-indigo-600 text-white rounded-tr-sm'
            : isDark 
              ? 'bg-slate-800 text-slate-200 rounded-tl-sm' 
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
        }`}>
          {message.role === 'assistant' ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: renderCodeBlock
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle opacity-50" />
              )}
            </div>
          ) : (
            message.content
          )}
        </div>

        {message.role === 'assistant' && (
          <div className="flex items-center gap-2 mt-1">
            {message.sources && message.sources.length > 0 && (
              <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                <div className="flex flex-wrap gap-1">
                  {message.sources.slice(0, 3).map((source) => (
                    <button
                      key={source.id}
                      onClick={() => onNodeClick && onNodeClick(source.id)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                        isDark 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      <BookOpen size={10} />
                      <span className="truncate max-w-[80px]">{source.title}</span>
                      <span className="text-[10px] opacity-50">
                        {Math.round(source.similarity * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {voiceControl}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface LoadingMessageProps {
  isDark: boolean;
  isTutorMode: boolean;
}

export const LoadingMessage: React.FC<LoadingMessageProps> = ({ isDark, isTutorMode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex gap-3"
  >
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
      isDark ? 'bg-slate-700' : 'bg-gray-200'
    }`}>
      <Loader2 size={16} className={`animate-spin ${isTutorMode 
        ? isDark ? 'text-amber-400' : 'text-amber-600'
        : isDark ? 'text-indigo-400' : 'text-indigo-600'
      }`} />
    </div>
    <div className={`p-3 rounded-2xl rounded-tl-sm ${
      isDark ? 'bg-slate-800' : 'bg-gray-100'
    }`}>
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </motion.div>
);

export default ChatMessage;
