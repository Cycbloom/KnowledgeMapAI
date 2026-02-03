import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowLeft, BookOpen, MessageSquare, Send, Bot, User, Loader2, Sparkles, GraduationCap, RefreshCw, Menu, PanelLeftClose, PanelLeftOpen, List, Network, Sun, Moon, Mic, MicOff } from 'lucide-react';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';
import { useGraphData } from '../hooks/useQueries';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { preprocessMarkdown } from '../utils/markdownUtils';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

export const LearningMode = () => {
  const { isDark, toggleTheme } = useTheme();
  const { addMessage } = useMessageStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nodeId = searchParams.get('node_id');
  const graphId = searchParams.get('graph_id');

  const [nodeTitle, setNodeTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  // Fetch Graph Data for Outline
  const { data: graphData } = useGraphData(graphId || '');

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的专属学习导师。正在为你生成课程内容，稍后你可以随时向我提问。'
    }
  ]);
  const [input, setInput] = useState('');
  const [inputBeforeVoice, setInputBeforeVoice] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Speech Recognition
  const { isListening, transcript, startListening, stopListening, error: speechError, hasRecognitionSupport } = useSpeechRecognition();

  useEffect(() => {
    if (speechError) {
      const isNetworkError = speechError.includes('网络连接错误');
      addMessage({ 
        type: 'error', 
        content: speechError,
        duration: isNetworkError ? 8000 : 5000,
        action: isNetworkError ? {
          label: '查看解决方法',
          onClick: () => {
            alert('语音识别失败原因排查：\n1. 浏览器限制：Chrome 依赖 Google 服务，若网络环境限制访问 Google，会导致此错误。\n2. 尝试建议：请检查网络代理设置，或尝试使用 Edge 浏览器（通常在某些环境下更稳定）。\n3. 离线支持：当前浏览器暂不支持离线语音识别。');
          }
        } : undefined
      });
    }
  }, [speechError, addMessage]);

  useEffect(() => {
    if (isListening) {
      // While listening, show what was typed before + current transcript
      setInput(inputBeforeVoice + (inputBeforeVoice && transcript ? ' ' : '') + transcript);
    } else if (transcript) {
      // When stopped, sync the final transcript
      setInput(inputBeforeVoice + (inputBeforeVoice && transcript ? ' ' : '') + transcript);
    }
  }, [transcript, isListening, inputBeforeVoice]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!hasRecognitionSupport) {
      addMessage({ type: 'warning', content: '您的浏览器不支持语音识别功能，请尝试使用 Chrome 浏览器。' });
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      setInputBeforeVoice(input);
      startListening();
    }
  };

  // Load Node and Generate Content
  useEffect(() => {
    if (!nodeId) {
      setNodeTitle('');
      setArticleContent('');
      return;
    }

    const loadData = async () => {
      try {
        setIsGenerating(true);
        // 1. Fetch Node Details
        const node = await api.nodes.get(nodeId);
        setNodeTitle(node.title);

        // 2. Check if learning material already exists
        if (node.learning_material) {
          console.log('Found existing learning material');
          setArticleContent(node.learning_material);
          setMessages(prev => [
            ...prev,
            {
              id: `existing-${Date.now()}`,
              role: 'assistant',
              content: `欢迎回来！这是为您准备的 "${node.title}" 学习教材。如果您有任何疑问，请随时提问。`
            }
          ]);
          setIsGenerating(false);
          return;
        }

        console.log('Generating new learning material...');
        // 3. Generate Learning Material
        const response = await api.ai.generateLearningMaterial({
          topic: node.title,
          context: node.content,
          level: node.level
        });

        // 4. Save the generated material back to the node
        if (response.content) {
          setArticleContent(response.content);
          
          try {
            console.log('Saving generated material to node:', nodeId);
            const updateResult = await api.nodes.update(nodeId, {
              learning_material: response.content
            });
            console.log('Save result:', updateResult);
            addMessage({ type: 'success', content: '学习教材已自动保存' });
          } catch (saveError) {
            console.error('Failed to save learning material:', saveError);
            addMessage({ type: 'error', content: '教材保存失败，下次进入将重新生成' });
          }

          setMessages(prev => [
            ...prev,
            {
              id: `generated-${Date.now()}`,
              role: 'assistant',
              content: `课程内容已生成！请仔细阅读左侧的教材。如果有任何疑问，或想深入了解某个概念，请直接问我。`
            }
          ]);
        }
      } catch (error) {
        console.error('Failed to load learning material:', error);
        addMessage({ type: 'error', content: '生成学习内容失败，请重试' });
      } finally {
        setIsGenerating(false);
      }
    };

    loadData();
  }, [nodeId]);

  // Chat Logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsChatLoading(true);

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

      // Add current article context to the chat
      const contextMessage = `Current Learning Context (Article):\n${articleContent.substring(0, 5000)}...`;
      
      // Inject context into history (hacky but works for stateless chat)
      // Ideally we pass context_node_ids
      
      await api.ai.chatStream(
        {
          message: userMessage.content,
          graph_id: graphId || '', // Might be empty if not passed, handled by backend gracefully?
          history: history,
          context_node_ids: nodeId ? [nodeId] : undefined
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

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '抱歉，我现在无法回答。请稍后再试。', isStreaming: false }
          : msg
      ));
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleStartChallenge = () => {
    navigate(`/study?node_id=${nodeId}&graph_id=${graphId}&mode=quiz`);
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`h-16 border-b flex items-center justify-between px-4 lg:px-6 flex-shrink-0 ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => window.history.back()}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ArrowLeft size={20} />
          </button>
          
          <button
            onClick={() => setIsOutlineOpen(!isOutlineOpen)}
            className={`p-2 rounded-lg transition-colors hidden lg:block ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={isOutlineOpen ? "收起大纲" : "展开大纲"}
          >
            {isOutlineOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg">闯关学习模式</h1>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {nodeTitle || (graphData ? '请选择课程章节' : '加载中...')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-lg transition-colors xl:hidden ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={isChatOpen ? "隐藏 AI 助手" : "显示 AI 助手"}
          >
            <MessageSquare size={20} className={isChatOpen ? 'text-indigo-500' : ''} />
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-gray-100 text-indigo-600'
            }`}
            title={isDark ? "切换到浅色模式" : "切换到深色模式"}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => navigate(`/graph/${graphId}`)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
              isDark 
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="进入 3D 思维导图"
          >
            <Network size={18} />
            <span className="hidden sm:inline">思维导图</span>
          </button>

          {nodeId && (
            <button
              onClick={handleStartChallenge}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105 active:scale-95"
            >
              <GraduationCap size={18} />
              <span>完成学习，开始挑战</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Outline Sidebar */}
        <div className={`${
          isOutlineOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 ease-in-out border-r dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 relative`}>
           <div className="absolute inset-0 w-80">
             {graphData ? (
               <GraphOutline 
                 nodes={graphData.nodes}
                 edges={graphData.edges}
                 onNodeClick={(node) => navigate(`/learning?graph_id=${graphId}&node_id=${node.id}`)}
                 selectedNodeId={nodeId}
                 className="h-full border-none"
               />
             ) : (
               <div className="flex items-center justify-center h-full text-slate-400">
                 <Loader2 className="animate-spin mr-2" />
                 加载大纲...
               </div>
             )}
           </div>
        </div>

        {/* Content Area */}
        {nodeId ? (
          <>
            {/* Left: Article Reader */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 border-r dark:border-slate-800 relative bg-white dark:bg-slate-900">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles size={24} className="text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>AI 正在为您编写教材...</h3>
                    <p className={isDark ? 'text-slate-400' : 'text-gray-500'}>正在生成关于 "{nodeTitle}" 的深度学习内容</p>
                  </div>
                </div>
              ) : (
                <div className={`max-w-3xl mx-auto prose prose-lg dark:prose-invert prose-indigo ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>
                   <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                  >
                    {preprocessMarkdown(articleContent)}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Right: AI Tutor */}
            <div className={`
              ${isChatOpen ? 'w-full lg:w-96 fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-0 flex' : 'hidden'} 
              flex-col border-l dark:border-slate-800 ${isDark ? 'bg-slate-900 lg:bg-slate-800/30' : 'bg-white'} 
              transition-all duration-300
            `}>
              <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50'} flex items-center justify-between`}>
                <div className="flex items-center space-x-2">
                  <Bot size={18} className="text-indigo-500" />
                  <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-gray-900'}`}>AI 导师</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">在线</span>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 lg:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-transparent">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-2 ${
                      msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : (isDark ? 'bg-slate-700 text-slate-50' : 'bg-white border border-gray-100 text-gray-800') + ' rounded-tl-none'
                    }`}>
                      <div className={`leading-relaxed ${msg.role === 'assistant' ? 'prose prose-sm dark:prose-invert max-w-none text-inherit' : 'whitespace-pre-wrap text-inherit'}`}>
                        <div className={isDark && msg.role === 'assistant' ? 'text-slate-50' : ''}>
                          {msg.role === 'assistant' ? (
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]} 
                              rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                            >
                              {preprocessMarkdown(msg.content)}
                            </ReactMarkdown>
                          ) : (
                            msg.content
                          )}
                        </div>
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-4 ml-1 bg-green-500 animate-pulse align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleChatSubmit} className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 pr-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isListening ? "正在聆听..." : "有不懂的地方？问问导师..."}
                    className={`flex-1 p-2 bg-transparent border-none focus:ring-0 outline-none text-sm ${isDark ? 'text-white placeholder-slate-400' : 'text-gray-900 placeholder-gray-400'}`}
                    disabled={isChatLoading || isListening}
                  />
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-lg transition-colors relative ${
                      isListening
                        ? 'bg-red-50 text-red-500 animate-pulse'
                        : (isDark ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-gray-200 text-gray-500')
                    }`}
                    title={isListening ? "点击停止录音" : "点击开始语音输入"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    {isListening && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    )}
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || isChatLoading}
                    className={`p-2 rounded-lg transition-colors ${
                      input.trim() 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                        : 'bg-gray-200 text-gray-400 dark:bg-slate-600 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          // Empty State / Welcome Screen
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 text-center p-8">
            <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <BookOpen size={48} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              开始您的学习之旅
            </h2>
            <p className="text-gray-500 dark:text-slate-400 max-w-md mb-8">
              请从左侧大纲中选择一个章节开始学习。每个章节都包含详细的 AI 生成教材和专属导师辅导。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl text-left">
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                  <List size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">结构化大纲</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">清晰的知识树结构，帮助您系统地掌握知识体系。</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 text-purple-600">
                  <Sparkles size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">AI 智能教材</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">根据节点内容自动生成深度学习资料，图文并茂。</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4 text-green-600">
                  <Bot size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">专属导师</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">随时提问，AI 导师结合当前教材为您答疑解惑。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
