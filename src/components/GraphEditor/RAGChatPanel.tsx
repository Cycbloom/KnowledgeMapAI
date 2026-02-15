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
  Lightbulb,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Settings2,
  Cpu,
  Globe,
  Plus,
  GraduationCap
} from 'lucide-react';
import { api } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useMessageStore } from '../../store/useMessageStore';
import { ExtractedConcept, TutorMode, TTSEngine } from '../../types';
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
  isStreaming?: boolean;
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
  selectedNodeIds?: string[];
  aiEnabled?: boolean;
  isTutorMode?: boolean;
  tutorMode?: TutorMode;
  extractedConcepts?: ExtractedConcept[];
  onToggleTutorMode?: () => void;
  onSwitchTutorMode?: (mode: TutorMode) => void;
  onExtractConcepts?: (text: string) => void;
  onAddConceptToGraph?: (concept: ExtractedConcept) => void;
  onAddAllConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  suggestedNextTopics?: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>;
  onTutorChat?: (message: string, history: any[], onChunk: (content: string) => void) => void;
}

export const RAGChatPanel: React.FC<RAGChatPanelProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  onClose,
  isOpen = true,
  selectedNodeIds = [],
  aiEnabled,
  isTutorMode = false,
  tutorMode = 'free',
  extractedConcepts = [],
  onToggleTutorMode,
  onSwitchTutorMode,
  onExtractConcepts,
  onAddConceptToGraph,
  onAddAllConcepts,
  onSuggestNextTopics,
  suggestedNextTopics = [],
  onTutorChat
}) => {
  const { isDark } = useTheme();
  const { addMessage } = useMessageStore();
  const [ttsEngine, setTTSEngine] = useState<TTSEngine>('browser');
  const { 
    isSpeaking, 
    isPaused, 
    isLoading: ttsLoading,
    error: ttsError, 
    voices, 
    selectedVoice, 
    speak, 
    pause, 
    resume, 
    cancel, 
    setVoice,
    switchEngine,
    hasSupport 
  } = useTextToSpeech(ttsEngine);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showConceptsPanel, setShowConceptsPanel] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [currentSpeakingMessageId, setCurrentSpeakingMessageId] = useState<string | null>(null);
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
      setSuggestedQuestions(isTutorMode ? [
        `帮我理解${currentNodeTitle}的核心概念`,
        `${currentNodeTitle}有哪些应用场景？`,
        `学习${currentNodeTitle}需要哪些前置知识？`
      ] : [
        `什么是${currentNodeTitle}？`,
        `${currentNodeTitle}的核心概念是什么？`,
        `${currentNodeTitle}有哪些应用场景？`
      ]);
    }
  }, [currentNodeTitle, messages.length, isTutorMode]);

  const handlePlayMessage = (message: Message) => {
    if (currentSpeakingMessageId === message.id && isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else {
      setCurrentSpeakingMessageId(message.id);
      speak(message.content);
    }
  };

  const handleStopMessage = () => {
    cancel();
    setCurrentSpeakingMessageId(null);
  };

  const handleVoiceChange = (voice: SpeechSynthesisVoice) => {
    if (ttsEngine === 'browser') {
      setVoice(voice);
    }
    setShowVoiceSettings(false);
  };

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

    const assistantMessageId = (Date.now() + 1).toString();

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      let fullResponse = '';
      let sources: Source[] = [];

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (isTutorMode && onTutorChat) {
        await onTutorChat(text, history, (chunk) => {
          fullResponse += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullResponse }
              : msg
          ));
        });
      } else {
        await api.rag.chatStream(
          {
            message: text,
            graph_id: graphId,
            current_node_id: currentNodeId,
            history
          },
          (chunk) => {
            fullResponse += chunk;
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: fullResponse }
                : msg
            ));
          },
          (s) => {
            sources = s;
          }
        );
      }

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, sources, isStreaming: false }
          : msg
      ));

      if (currentNodeTitle) {
        setSuggestedQuestions(isTutorMode ? [
          `深入解释${currentNodeTitle}的原理`,
          `如何应用${currentNodeTitle}？`,
          `有哪些相关的知识点？`
        ] : [
          `深入解释${currentNodeTitle}的原理`,
          `${currentNodeTitle}与其他概念有什么关联？`,
          `如何应用${currentNodeTitle}？`
        ]);
      }

    } catch (error: any) {
      console.error('RAG Chat Error:', error);
      addMessage({ type: 'error', content: '发送失败，请重试' });
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '抱歉，发生了错误，请稍后再试。', isStreaming: false }
          : msg
      ));
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

  const handleExtractConcepts = () => {
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
    if (lastAssistantMessage && onExtractConcepts) {
      onExtractConcepts(lastAssistantMessage.content);
      setShowConceptsPanel(true);
    }
  };

  const handleAddConcept = (concept: ExtractedConcept) => {
    if (onAddConceptToGraph) {
      onAddConceptToGraph(concept);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return isDark ? 'bg-red-900/30 text-red-300 border-red-800' : 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return isDark ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return isDark ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-green-100 text-green-700 border-green-200';
      default: return isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-700 border-gray-200';
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

  const headerBgClass = isTutorMode 
    ? 'from-amber-600 to-orange-500' 
    : 'from-indigo-600 to-purple-500';

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
      } bg-gradient-to-r ${headerBgClass} text-white`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20">
            {isTutorMode ? <GraduationCap size={20} /> : <Sparkles size={20} />}
          </div>
          <div>
            <h3 className="font-bold">{isTutorMode ? 'AI 助教' : '智能问答'}</h3>
            <p className="text-xs text-white/80">
              {isTutorMode ? '引导学习 · 概念提取' : '基于知识图谱的 AI 助手'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasSupport && (
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showVoiceSettings ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title="语音设置"
            >
              <Settings2 size={16} />
            </button>
          )}
          {onToggleTutorMode && (
            <button
              onClick={onToggleTutorMode}
              className={`p-2 rounded-lg transition-colors ${
                isTutorMode ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
              title={isTutorMode ? '切换到普通模式' : '切换到助教模式'}
            >
              {isTutorMode ? <MessageCircle size={16} /> : <GraduationCap size={16} />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {showVoiceSettings && hasSupport && (
        <div className={`px-4 py-3 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-indigo-50 border-indigo-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>语音设置</span>
            <button
              onClick={() => setShowVoiceSettings(false)}
              className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>语音引擎：</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    switchEngine('browser');
                    setTTSEngine('browser');
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                    ttsEngine === 'browser'
                      ? 'bg-indigo-600 text-white'
                      : isDark 
                        ? 'bg-slate-700 text-indigo-300 hover:bg-slate-600' 
                        : 'bg-white text-indigo-600 hover:bg-indigo-100'
                  }`}
                >
                  <Globe size={12} />
                  <span>浏览器</span>
                </button>
                <button
                  onClick={() => {
                    switchEngine('qwen3');
                    setTTSEngine('qwen3');
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                    ttsEngine === 'qwen3'
                      ? 'bg-indigo-600 text-white'
                      : isDark 
                        ? 'bg-slate-700 text-indigo-300 hover:bg-slate-600' 
                        : 'bg-white text-indigo-600 hover:bg-indigo-100'
                  }`}
                >
                  <Cpu size={12} />
                  <span>Qwen3-TTS</span>
                </button>
              </div>
            </div>
          </div>
          
          {ttsEngine === 'browser' && (
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {voices.map((voice, index) => (
                <button
                  key={index}
                  onClick={() => handleVoiceChange(voice)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-all ${
                    typeof selectedVoice === 'object' && selectedVoice?.name === voice.name
                      ? 'bg-indigo-600 text-white'
                      : isDark 
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                        : 'bg-white text-indigo-600 hover:bg-indigo-100'
                  }`}
                >
                  <div className="font-medium">{voice.name}</div>
                  <div className="opacity-75">{voice.lang}</div>
                </button>
              ))}
            </div>
          )}
          
          {ttsError && (
            <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
              {ttsError}
            </div>
          )}
        </div>
      )}

      {isTutorMode && (
        <div className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>模式：</span>
            <div className="flex gap-1">
              <button
                onClick={() => onSwitchTutorMode?.('free')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === 'free'
                    ? 'bg-amber-500 text-white'
                    : isDark 
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                      : 'bg-white text-amber-600 hover:bg-amber-100'
                }`}
              >
                自由对话
              </button>
              <button
                onClick={() => onSwitchTutorMode?.('guided')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === 'guided'
                    ? 'bg-amber-500 text-white'
                    : isDark 
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                      : 'bg-white text-amber-600 hover:bg-amber-100'
                }`}
              >
                引导学习
              </button>
            </div>
          </div>
        </div>
      )}

      {aiEnabled === false && (
        <div className={`px-4 py-2 text-xs border-b ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
          AI 未配置：当前为模拟回复，请配置 AI Key 获取真实结果
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className={`p-4 rounded-2xl mb-4 ${
              isTutorMode 
                ? isDark ? 'bg-amber-900/30' : 'bg-amber-50'
                : isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
            }`}>
              <Bot size={40} className={isTutorMode 
                ? isDark ? 'text-amber-400' : 'text-amber-600'
                : isDark ? 'text-indigo-400' : 'text-indigo-600'
              } />
            </div>
            <h4 className={`font-semibold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              {isTutorMode ? '你好！我是你的 AI 助教' : '你好！我是知识图谱助手'}
            </h4>
            <p className={`text-sm mb-6 max-w-[280px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {isTutorMode 
                ? '我可以帮助你学习知识图谱，提取关键概念，并建议下一步的学习方向。' 
                : '我可以帮你理解知识图谱中的内容，回答问题，发现知识关联。'}
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
                      <Lightbulb size={14} className={isTutorMode 
                        ? isDark ? 'text-amber-400' : 'text-amber-500'
                        : isDark ? 'text-indigo-400' : 'text-indigo-500'
                      } />
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
                  
                  {hasSupport && !message.isStreaming && message.content && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handlePlayMessage(message)}
                        disabled={ttsLoading}
                        className={`p-1.5 rounded-lg transition-colors ${
                          currentSpeakingMessageId === message.id && isSpeaking
                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
                            : isDark 
                              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } disabled:opacity-50`}
                        title={currentSpeakingMessageId === message.id && isSpeaking ? (isPaused ? '继续' : '暂停') : '朗读'}
                      >
                        {ttsLoading && currentSpeakingMessageId === message.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : currentSpeakingMessageId === message.id && isSpeaking ? (
                          isPaused ? <Play size={12} /> : <Pause size={12} />
                        ) : (
                          <Volume2 size={12} />
                        )}
                      </button>
                      {currentSpeakingMessageId === message.id && isSpeaking && (
                        <button
                          onClick={handleStopMessage}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDark 
                              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                          title="停止"
                        >
                          <VolumeX size={12} />
                        </button>
                      )}
                    </div>
                  )}
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
        )}

        <div ref={messagesEndRef} />
      </div>

      {showConceptsPanel && extractedConcepts.length > 0 && (
        <div className={`border-t p-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold flex items-center ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              <Lightbulb size={16} className="mr-2 text-yellow-500" />
              提取的概念
            </h3>
            <button
              onClick={() => setShowConceptsPanel(false)}
              className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {extractedConcepts.map((concept, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getPriorityColor(concept.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{concept.title}</h4>
                    <p className="text-xs mt-1 opacity-80">{concept.description}</p>
                  </div>
                  <button
                    onClick={() => handleAddConcept(concept)}
                    className="ml-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    title="添加到图谱"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {onAddAllConcepts && (
            <button
              onClick={onAddAllConcepts}
              className="w-full mt-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              全部添加到图谱
            </button>
          )}
        </div>
      )}

      {showSuggestionsPanel && suggestedNextTopics.length > 0 && (
        <div className={`border-t p-4 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold flex items-center ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
              <Sparkles size={16} className="mr-2 text-purple-500" />
              学习建议
            </h3>
            <button
              onClick={() => setShowSuggestionsPanel(false)}
              className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {suggestedNextTopics.map((topic, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getPriorityColor(topic.priority)}`}
              >
                <h4 className="font-medium text-sm">{topic.title}</h4>
                <p className="text-xs mt-1 opacity-80">{topic.description}</p>
                <div className="flex items-center mt-2 gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-slate-700' : 'bg-white/50'}`}>
                    难度: {topic.estimatedDifficulty}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        {selectedNodeIds.length > 0 && (
          <div className={`mb-2 text-xs px-2 py-1 rounded inline-block ${
            isTutorMode 
              ? isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-600'
              : isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
          }`}>
            已选中 {selectedNodeIds.length} 个节点作为上下文
          </div>
        )}
        <div className={`flex items-end gap-2 p-2 rounded-2xl ${
          isDark ? 'bg-slate-800' : 'bg-gray-100'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTutorMode ? "与助教对话..." : "输入你的问题..."}
            rows={1}
            className={`flex-1 bg-transparent resize-none outline-none text-sm ${
              isDark ? 'text-slate-200 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'
            }`}
            style={{ maxHeight: '120px' }}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? isTutorMode 
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
              onClick={handleExtractConcepts}
              disabled={messages.filter(m => m.role === 'assistant').length === 0}
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
                onClick={() => {
                  onSuggestNextTopics();
                  setShowSuggestionsPanel(true);
                }}
                className={`flex-1 p-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                  isDark 
                    ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50' 
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <Sparkles size={14} />
                学习建议
              </button>
            )}
          </div>
        )}
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
  selectedNodeIds?: string[];
  aiEnabled?: boolean;
  isTutorMode?: boolean;
  tutorMode?: TutorMode;
  extractedConcepts?: ExtractedConcept[];
  onToggleTutorMode?: () => void;
  onSwitchTutorMode?: (mode: TutorMode) => void;
  onExtractConcepts?: (text: string) => void;
  onAddConceptToGraph?: (concept: ExtractedConcept) => void;
  onAddAllConcepts?: () => void;
  onSuggestNextTopics?: () => void;
  suggestedNextTopics?: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low'; estimatedDifficulty: number }>;
  onTutorChat?: (message: string, history: any[], onChunk: (content: string) => void) => void;
}

export const RAGChatButton: React.FC<RAGChatButtonProps> = ({
  graphId,
  currentNodeId,
  currentNodeTitle,
  onNodeClick,
  isOpen: externalIsOpen,
  onOpenChange,
  selectedNodeIds,
  aiEnabled,
  isTutorMode,
  tutorMode,
  extractedConcepts,
  onToggleTutorMode,
  onSwitchTutorMode,
  onExtractConcepts,
  onAddConceptToGraph,
  onAddAllConcepts,
  onSuggestNextTopics,
  suggestedNextTopics,
  onTutorChat
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
          isTutorMode
            ? isDark 
              ? 'bg-amber-600 hover:bg-amber-500 text-white' 
              : 'bg-amber-500 hover:bg-amber-600 text-white'
            : isDark 
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
              : 'bg-indigo-500 hover:bg-indigo-600 text-white'
        }`}
        title={isTutorMode ? 'AI 助教' : '智能问答'}
      >
        {isTutorMode ? <GraduationCap size={18} /> : <MessageCircle size={18} />}
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
                selectedNodeIds={selectedNodeIds}
                aiEnabled={aiEnabled}
                isTutorMode={isTutorMode}
                tutorMode={tutorMode}
                extractedConcepts={extractedConcepts}
                onToggleTutorMode={onToggleTutorMode}
                onSwitchTutorMode={onSwitchTutorMode}
                onExtractConcepts={onExtractConcepts}
                onAddConceptToGraph={onAddConceptToGraph}
                onAddAllConcepts={onAddAllConcepts}
                onSuggestNextTopics={onSuggestNextTopics}
                suggestedNextTopics={suggestedNextTopics}
                onTutorChat={onTutorChat}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RAGChatPanel;
