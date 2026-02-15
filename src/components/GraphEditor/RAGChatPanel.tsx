import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  X, 
  Sparkles, 
  BookOpen, 
  Loader2,
  Bot,
  User,
  Lightbulb
} from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface Source {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

interface RAGChatPanelProps {
  graphId?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  onNodeClick?: (nodeId: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export const RAGChatPanel: React.FC<RAGChatPanelProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  onClose,
  isOpen = true
}) => {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentNodeTitle && messages.length === 0) {
      setSuggestedQuestions([
        `什么是${currentNodeTitle}？`,
        `${currentNodeTitle}的核心概念是什么？`,
        `${currentNodeTitle}有哪些应用场景？`
      ]);
    }
  }, [currentNodeTitle, messages.length]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setSuggestedQuestions([]);

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      let fullResponse = '';
      let sources: Source[] = [];

      await api.rag.chatStream(
        {
          message: text,
          graph_id: graphId,
          current_node_id: currentNodeId,
          history
        },
        (chunk) => {
          fullResponse += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = fullResponse;
            } else {
              newMessages.push({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date()
              });
            }
            return newMessages;
          });
        },
        (s) => {
          sources = s;
        }
      );

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.sources = sources;
        }
        return newMessages;
      });

      if (currentNodeTitle) {
        setSuggestedQuestions([
          `深入解释${currentNodeTitle}的原理`,
          `${currentNodeTitle}与其他概念有什么关联？`,
          `如何应用${currentNodeTitle}？`
        ]);
      }

    } catch (error: any) {
      console.error('RAG Chat Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生了错误：${error.message || '未知错误'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`flex flex-col h-full ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
      } border-r`}
    >
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark ? 'border-slate-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${
            isDark ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
          }`}>
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold">智能问答</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              基于知识图谱的 AI 助手
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className={`p-4 rounded-2xl mb-4 ${
              isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
            }`}>
              <Bot size={40} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
            </div>
            <h4 className={`font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              你好！我是知识图谱助手
            </h4>
            <p className={`text-sm mb-6 max-w-[280px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              我可以帮你理解知识图谱中的内容，回答问题，发现知识关联。
            </p>
            
            {suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2">
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  试试这些问题：
                </p>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                      isDark 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} className={isDark ? 'text-amber-400' : 'text-amber-500'} />
                      <span>{q}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? isDark ? 'bg-indigo-600' : 'bg-indigo-500'
                : isDark ? 'bg-slate-700' : 'bg-gray-200'
            }`}>
              {message.role === 'user' ? (
                <User size={16} className="text-white" />
              ) : (
                <Bot size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
              )}
            </div>
            
            <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-3 rounded-2xl text-sm ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
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
                  </div>
                ) : (
                  message.content
                )}
              </div>

              {message.sources && message.sources.length > 0 && (
                <div className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  <p className="mb-1 font-medium">参考来源：</p>
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
                        <span className="truncate max-w-[100px]">{source.title}</span>
                        <span className="text-[10px] opacity-50">
                          {Math.round(source.similarity * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'bg-slate-700' : 'bg-gray-200'
            }`}>
              <Loader2 size={16} className={`animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
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
        )}

        <div ref={messagesEndRef} />
      </div>

      {suggestedQuestions.length > 0 && messages.length > 0 && !isLoading && (
        <div className={`px-4 py-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {suggestedQuestions.slice(0, 2).map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className={`flex items-end gap-2 p-2 rounded-2xl ${
          isDark ? 'bg-slate-800' : 'bg-gray-100'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            rows={1}
            className={`flex-1 bg-transparent resize-none outline-none text-sm ${
              isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
            }`}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
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
      </div>
    </motion.div>
  );
};

interface RAGChatButtonProps {
  graphId?: string;
  currentNodeId?: string;
  currentNodeTitle?: string;
  onNodeClick?: (nodeId: string) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RAGChatButton: React.FC<RAGChatButtonProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  isOpen: externalIsOpen,
  onOpenChange
}) => {
  const { isDark } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-16 left-4 z-40 p-2.5 rounded-xl shadow-lg transition-colors ${
          isDark 
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
            : 'bg-indigo-500 hover:bg-indigo-600 text-white'
        }`}
        title="智能问答"
      >
        <MessageCircle size={18} />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white animate-pulse" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed top-0 left-0 bottom-0 z-50 w-full max-w-md pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="h-full pointer-events-auto"
            >
              <RAGChatPanel
                graphId={graphId}
                currentNodeId={currentNodeId}
                currentNodeTitle={currentNodeTitle}
                onNodeClick={onNodeClick}
                onClose={() => setIsOpen(false)}
                isOpen={isOpen}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RAGChatPanel;
