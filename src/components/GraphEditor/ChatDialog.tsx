import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Bot, User, Loader2, Sparkles, Lightbulb, Plus, BookOpen, Volume2, VolumeX, Pause, Play, Settings2, Cpu, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { CodeBlock } from '../CodeBlock';
import { api } from '../../services/api';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import { useMessageStore } from '../../store/useMessageStore';
import { ExtractedConcept, TutorMode, TTSEngine } from '../../types';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useTheme } from '../../hooks/useTheme';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  selectedNodeIds: string[];
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

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

export const ChatDialog: React.FC<ChatDialogProps> = ({ 
  isOpen, 
  onClose, 
  graphId, 
  selectedNodeIds, 
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
  const { addMessage } = useMessageStore();
  const { isDark } = useTheme();
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
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: isTutorMode 
        ? '你好！我是你的AI助教。我可以帮助你学习知识图谱，提取关键概念，并建议下一步的学习方向。'
        : '你好！我是你的图谱助手。你可以问我关于这个知识图谱的任何问题。如果选中了特定节点，我会优先基于选中的内容回答。'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConceptsPanel, setShowConceptsPanel] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentSpeakingMessageId, setCurrentSpeakingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      let fullContent = '';
      
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      if (isTutorMode && onTutorChat) {
        await onTutorChat(userMessage.content, history, (chunk) => {
          fullContent += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullContent }
              : msg
          ));
        });
      } else {
        await api.ai.chatStream(
          {
            message: userMessage.content,
            graph_id: graphId,
            history: history,
            context_node_ids: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
          },
          (chunk) => {
            fullContent += chunk;
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: fullContent }
                : msg
            ));
          }
        );
      }

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error: any) {
      console.error('Chat error:', error);
      addMessage({ type: 'error', content: '发送失败，请重试' });
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '抱歉，我现在无法回答。请稍后再试。', isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
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
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[500px] h-[700px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 animate-in slide-in-from-bottom-10 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-xl">
        <div className="flex items-center space-x-2">
          {isTutorMode ? <Sparkles size={20} /> : <MessageSquare size={20} />}
          <h2 className="font-semibold">{isTutorMode ? 'AI 助教' : '图谱助手'}</h2>
          {hasSupport && (
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-1.5 rounded-lg transition-all ${
                showVoiceSettings 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-transparent hover:bg-white/10'
              }`}
              title="语音设置"
            >
              <Settings2 size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {onToggleTutorMode && (
            <button 
              onClick={onToggleTutorMode}
              className={`p-1.5 rounded-lg transition-all ${
                isTutorMode 
                  ? 'bg-white/20 hover:bg-white/30' 
                  : 'bg-transparent hover:bg-white/10'
              }`}
              title={isTutorMode ? '关闭助教模式' : '开启助教模式'}
            >
              {isTutorMode ? <BookOpen size={16} /> : <Lightbulb size={16} />}
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Voice Settings Panel */}
      {showVoiceSettings && hasSupport && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-blue-600 font-medium">语音设置</span>
            <button
              onClick={() => setShowVoiceSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
          
          {/* TTS Engine Toggle */}
          <div className="mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-blue-600">语音引擎：</span>
              <div className="flex space-x-1">
                <button
                  onClick={() => {
                    switchEngine('browser');
                    setTTSEngine('browser');
                  }}
                  className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                    ttsEngine === 'browser'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-100'
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
                  className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded-md transition-all ${
                    ttsEngine === 'qwen3'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  <Cpu size={12} />
                  <span>Qwen3-TTS</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Voice Selection */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {ttsEngine === 'browser' ? (
                voices.map((voice, index) => (
                  <button
                    key={index}
                    onClick={() => handleVoiceChange(voice)}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-all ${
                      typeof selectedVoice === 'object' && selectedVoice?.name === voice.name
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <div className="font-medium">{voice.name}</div>
                    <div className="opacity-75">{voice.lang}</div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-blue-600 bg-white px-2 py-1.5 rounded-md">
                  使用 Qwen3-TTS 默认语音
                </div>
              )}
            </div>
          {ttsError && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              {ttsError}
            </div>
          )}
        </div>
      )}

      {/* Tutor Mode Toggle */}
      {isTutorMode && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-blue-600 font-medium">模式：</span>
            <div className="flex space-x-1">
              <button
                onClick={() => onSwitchTutorMode?.('free')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === 'free'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-100'
                }`}
              >
                自由对话
              </button>
              <button
                onClick={() => onSwitchTutorMode?.('guided')}
                className={`px-3 py-1 text-xs rounded-md transition-all ${
                  tutorMode === 'guided'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-blue-600 hover:bg-blue-100'
                }`}
              >
                引导学习
              </button>
            </div>
          </div>
        </div>
      )}

      {aiEnabled === false && (
        <div className="px-4 py-2 text-xs bg-amber-50 text-amber-800 border-b border-amber-100">
          AI 未配置：当前对话为模拟回复（用于演示），请配置 AI Key 获取真实结果
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-2 ${
              msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
            }`}>
              <div className={`leading-relaxed ${msg.role === 'assistant' ? 'prose prose-sm prose-blue max-w-none' : 'whitespace-pre-wrap'}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                    components={{
                      code: ({ className, children, node }) => (
                        <CodeBlock className={className} isDark={isDark} node={node}>
                          {children}
                        </CodeBlock>
                      )
                    }}
                  >
                    {preprocessMarkdown(msg.content)}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-green-500 animate-pulse align-middle" />
                )}
              </div>
            </div>
            {msg.role === 'assistant' && hasSupport && (
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => handlePlayMessage(msg)}
                  disabled={ttsLoading}
                  className={`p-1.5 rounded-lg transition-colors ${
                    currentSpeakingMessageId === msg.id && isSpeaking
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={currentSpeakingMessageId === msg.id && isSpeaking ? (isPaused ? '继续播放' : '暂停') : '播放'}
                >
                  {ttsLoading && currentSpeakingMessageId === msg.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : currentSpeakingMessageId === msg.id && isSpeaking ? (
                    isPaused ? <Play size={14} /> : <Pause size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                </button>
                {currentSpeakingMessageId === msg.id && isSpeaking && (
                  <button
                    onClick={handleStopMessage}
                    className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                    title="停止"
                  >
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Extracted Concepts Panel */}
      {showConceptsPanel && extractedConcepts.length > 0 && (
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center">
              <Lightbulb size={16} className="mr-2 text-yellow-500" />
              提取的概念
            </h3>
            <button
              onClick={() => setShowConceptsPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
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
                    className="ml-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              className="w-full mt-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              全部添加到图谱
            </button>
          )}
        </div>
      )}

      {/* Suggested Topics Panel */}
      {showSuggestionsPanel && suggestedNextTopics.length > 0 && (
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center">
              <Sparkles size={16} className="mr-2 text-purple-500" />
              学习建议
            </h3>
            <button
              onClick={() => setShowSuggestionsPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {suggestedNextTopics.map((topic, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getPriorityColor(topic.priority)}`}
              >
                <h4 className="font-medium text-sm">{topic.title}</h4>
                <p className="text-xs mt-1 opacity-80">{topic.description}</p>
                <div className="flex items-center mt-2 space-x-2">
                  <span className="text-xs bg-white/50 px-2 py-0.5 rounded">
                    难度: {topic.estimatedDifficulty}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
        {selectedNodeIds.length > 0 && (
          <div className="mb-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
            已选中 {selectedNodeIds.length} 个节点作为上下文
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isTutorMode ? "与助教对话..." : "问点什么..."}
            className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        
        {/* Tutor Mode Actions */}
        {isTutorMode && (
          <div className="flex space-x-2 mt-3">
            <button
              type="button"
              onClick={handleExtractConcepts}
              disabled={messages.length < 2}
              className="flex-1 p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              <Lightbulb size={14} className="mr-1" />
              提取概念
            </button>
            {onSuggestNextTopics && (
              <button
                type="button"
                onClick={() => {
                  onSuggestNextTopics();
                  setShowSuggestionsPanel(true);
                }}
                className="flex-1 p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-xs font-medium"
              >
                <Sparkles size={14} className="mr-1" />
                学习建议
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};