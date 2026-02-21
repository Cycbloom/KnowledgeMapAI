import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { TermTooltip } from '../components/TermTooltip';
import { CodeBlock } from '../components/CodeBlock';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ArrowLeft, BookOpen, MessageSquare, Send, Bot, User, Loader2, Sparkles, GraduationCap, RefreshCw, PanelLeftClose, PanelLeftOpen, Network, Sun, Moon, Mic, MicOff, BrainCircuit, Home, X, Plus, Route, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';
import { useGraphData, useGraphNodeStatus } from '../hooks/useQueries';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { preprocessMarkdown } from '../utils/markdownUtils';
import { GraphOutline } from '../components/GraphEditor/GraphOutline';
import { GenerateCardsModal } from '../components/LearningMode/GenerateCardsModal';
import { LearningPathPanel } from '../components/LearningPath/LearningPathPanel';
import { NodeLevel } from '../types';

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
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1280);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const isOnline = useNetworkStatus();

  const [isCreateNodeModalOpen, setIsCreateNodeModalOpen] = useState(false);
  const [rightPanelMode, setRightPanelMode] = useState<'chat' | 'learning-path'>('chat');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeContent, setNewNodeContent] = useState('');
  const [newNodeLevel, setNewNodeLevel] = useState<NodeLevel>('leaf');
  const [selectedParentNodeId, setSelectedParentNodeId] = useState<string>('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On mobile, if no nodeId is selected, we should show the outline
  useEffect(() => {
    if (isMobile && !nodeId) {
      setIsOutlineOpen(true);
    }
  }, [isMobile, nodeId]);
  
  // Fetch Graph Data for Outline
  const { data: graphData } = useGraphData(graphId || '');
  const { data: nodeStatus } = useGraphNodeStatus(graphId || '');

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

  // Helper for manual card generation
  const handleGenerateCards = async (targetNodeId: string) => {
    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([targetNodeId], {
        count: 10,
        types: ['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank']
      });
      
      if (result.success) {
        addMessage({ 
          type: 'success', 
          content: '题目自动生成任务已提交至后台',
          duration: 5000,
          action: {
            label: '查看任务',
            onClick: () => navigate('/tasks')
          }
        });
      }
    } catch (cardError) {
      console.error('Failed to generate cards:', cardError);
      addMessage({ type: 'error', content: '题目生成失败' });
    } finally {
      setIsGeneratingCards(false);
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
        setNodeTitle(node.knowledge_point?.title || '');

        // 2. Check if learning material already exists
        if (node.knowledge_point?.learning_material) {
          setArticleContent(node.knowledge_point?.learning_material);
          setMessages(prev => [
            ...prev,
            {
              id: `existing-${Date.now()}`,
              role: 'assistant',
              content: `欢迎回来！这是为您准备的 "${node.knowledge_point?.title}" 学习教材。如果您有任何疑问，请随时提问。`
            }
          ]);
          setIsGenerating(false);
          return;
        }

        // 3. Generate Learning Material
        const response = await api.ai.generateLearningMaterial({
          topic: node.knowledge_point?.title || '',
          context: node.knowledge_point?.content,
          level: node.knowledge_point?.level
        });

        // 4. Save the generated material back to the node
        if (response.content) {
          setArticleContent(response.content);
          
          try {
            await api.nodes.update(nodeId, {
              learning_material: response.content
            });
            
            // OPTIMIZATION: Manual trigger for questions instead of automatic
            addMessage({ 
              type: 'success', 
              content: '学习教材已生成',
              duration: 8000,
              action: {
                label: '生成练习题',
                onClick: () => handleGenerateCards(nodeId)
              }
            });
            
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

    if (!isOnline) {
      addMessage({ type: 'error', content: '离线模式下无法使用 AI 助教' });
      return;
    }

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
          history,
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

  const handleCreateNode = async () => {
    if (!graphId || !newNodeTitle.trim()) {
      addMessage({ type: 'warning', content: '请输入节点标题' });
      return;
    }

    try {
      const newNode = await api.nodes.create({
        graph_id: graphId,
        title: newNodeTitle,
        content: newNodeContent,
        x_position: Math.round((Math.random() - 0.5) * 20),
        y_position: Math.round((Math.random() - 0.5) * 20),
        level: newNodeLevel,
        properties: {}
      });

      if (selectedParentNodeId) {
        await api.edges.create({
          source_knowledge_point_id: selectedParentNodeId,
          target_knowledge_point_id: newNode.id,
          graph_id: graphId,
          relationship_type: 'related'
        });
      }

      addMessage({ type: 'success', content: '节点创建成功' });
      
      setNewNodeTitle('');
      setNewNodeContent('');
      setNewNodeLevel('leaf');
      setSelectedParentNodeId('');
      setIsCreateNodeModalOpen(false);

      queryClient.invalidateQueries({ queryKey: ['graphData', graphId] });
      queryClient.invalidateQueries({ queryKey: ['graphLearningPath', graphId] });

      if (graphData) {
        navigate(`/learning?graph_id=${graphId}&node_id=${newNode.id}`);
      }
    } catch (error) {
      console.error('Failed to create node:', error);
      addMessage({ type: 'error', content: '节点创建失败，请重试' });
    }
  };

  const handleStartChallenge = () => {
    navigate(`/study?node_id=${nodeId}&graph_id=${graphId}&mode=quiz`);
  };

  const handleManualGenerateCards = async (config: { count: number; types: string[] }) => {
    if (!nodeId) {
      addMessage({ type: 'warning', content: '请先选择知识点' });
      return;
    }

    if (!isOnline) {
      addMessage({ type: 'error', content: '离线模式下无法生成题目' });
      return;
    }

    setIsGeneratingCards(true);
    try {
      const result = await api.ai.batchGenerateCards([nodeId], {
        count: config.count,
        types: config.types
      });
      
      if (result.success) {
        addMessage({ 
          type: 'success', 
          content: '题目生成任务已提交至后台',
          duration: 5000,
          action: {
            label: '查看任务',
            onClick: () => navigate('/tasks')
          }
        });
      } else {
        addMessage({ type: 'error', content: '任务提交失败，请重试' });
      }
    } catch (error) {
      console.error('Manual generation failed:', error);
      addMessage({ type: 'error', content: '题目生成提交失败，请稍后重试' });
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleBatchAction = async (action: 'expand_graph' | 'delete' | 'batch_generate_questions', data?: any) => {
    const nodeIds = Array.from(selectedNodeIds);
    if (nodeIds.length === 0) {
      addMessage({ type: 'warning', content: '请先选择节点' });
      return;
    }

    if (action === 'delete') {
      try {
        await api.nodes.batchDelete(nodeIds);
        addMessage({ type: 'success', content: `已删除 ${nodeIds.length} 个节点` });
        setSelectedNodeIds(new Set());
        queryClient.invalidateQueries({ queryKey: ['graphData', graphId] });
        queryClient.invalidateQueries({ queryKey: ['graphLearningPath', graphId] });
      } catch (error) {
        console.error('Batch delete failed:', error);
        addMessage({ type: 'error', content: '批量删除失败，请重试' });
      }
    } else if (action === 'expand_graph') {
      if (!isOnline) {
        addMessage({ type: 'error', content: '离线模式下无法拓展图谱' });
        return;
      }
      try {
        const result = await api.ai.batchExpandGraph(nodeIds);
        if (result.success) {
          addMessage({ 
            type: 'success', 
            content: `已为 ${nodeIds.length} 个节点提交拓展任务`,
            duration: 5000,
            action: {
              label: '查看任务',
              onClick: () => navigate('/tasks')
            }
          });
          setSelectedNodeIds(new Set());
        } else {
          addMessage({ type: 'error', content: '任务提交失败，请重试' });
        }
      } catch (error) {
        console.error('Batch expand failed:', error);
        addMessage({ type: 'error', content: '批量拓展失败，请稍后重试' });
      }
    } else if (action === 'batch_generate_questions' && data) {
      if (!isOnline) {
        addMessage({ type: 'error', content: '离线模式下无法生成题目' });
        return;
      }

      setIsGeneratingCards(true);
      try {
        const result = await api.ai.batchGenerateCards(nodeIds, data);
        if (result.success) {
          addMessage({ 
            type: 'success', 
            content: `已为 ${nodeIds.length} 个节点提交生成任务`,
            duration: 5000,
            action: {
              label: '查看任务',
              onClick: () => navigate('/tasks')
            }
          });
          setSelectedNodeIds(new Set());
        } else {
          addMessage({ type: 'error', content: '任务提交失败，请重试' });
        }
      } catch (error) {
        console.error('Batch generation failed:', error);
        addMessage({ type: 'error', content: '批量生成失败，请稍后重试' });
      } finally {
        setIsGeneratingCards(false);
      }
    }
  };

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${isMobile ? 'h-14' : 'h-16'} border-b flex items-center justify-between px-3 lg:px-6 flex-shrink-0 ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-2 lg:space-x-4">
          <button 
            onClick={() => {
              if (isMobile && nodeId) {
                // Clear nodeId to go back to outline
                navigate(`/learning?graph_id=${graphId}`);
              } else {
                window.history.back();
              }
            }}
            className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="返回上一页"
          >
            <ArrowLeft size={isMobile ? 18 : 20} />
          </button>

          <button 
            onClick={() => navigate('/')}
            className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="返回首页"
          >
            <Home size={isMobile ? 18 : 20} />
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

          <div className="flex items-center space-x-2">
            <div className={`p-1 rounded-lg ${isDark ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <BookOpen size={isMobile ? 16 : 20} />
            </div>
            <div className={isMobile && nodeId ? 'hidden sm:block' : 'block'}>
              <h1 className="font-bold text-sm lg:text-lg whitespace-nowrap">闯关学习</h1>
              {!isMobile && (
                <p className={`text-[10px] lg:text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'} truncate max-w-[150px]`}>
                  {nodeTitle || (graphData ? '请选择课程章节' : '加载中...')}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-1.5 lg:p-2 rounded-lg transition-colors xl:hidden ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={isChatOpen ? "隐藏 AI 助手" : "显示 AI 助手"}
          >
            <MessageSquare size={isMobile ? 18 : 20} className={isChatOpen ? 'text-indigo-500' : ''} />
          </button>
        </div>
        
        <div className="flex items-center space-x-2 lg:space-x-3">
          <button
            onClick={toggleTheme}
            className={`p-1.5 lg:p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-gray-100 text-indigo-600'
            }`}
            title={isDark ? "切换到浅色模式" : "切换到深色模式"}
          >
            {isDark ? <Sun size={isMobile ? 18 : 20} /> : <Moon size={isMobile ? 18 : 20} />}
          </button>

          {!isMobile && (
            <>
              <button
                onClick={() => {
                  setRightPanelMode('learning-path');
                  setIsChatOpen(true);
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all ${
                  rightPanelMode === 'learning-path' && isChatOpen
                    ? 'bg-indigo-600 text-white'
                    : (isDark 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                }`}
                title="学习路径"
              >
                <Route size={18} />
                <span className="hidden sm:inline">学习路径</span>
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
            </>
          )}

          {nodeId && (
            <div className="group relative">
              <button
                onClick={() => isOnline && setIsGenModalOpen(true)}
                disabled={!isOnline}
                className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-full font-medium transition-all ${
                  !isOnline 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700'
                    : (isDark 
                        ? 'bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 border border-indigo-500/30' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200')
                }`}
                title={isOnline ? "配置并生成题目" : "离线模式不可用"}
              >
                <BrainCircuit size={18} />
                <span className="hidden md:inline">生成题目</span>
              </button>
              {!isOnline && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  离线不可用
                </div>
              )}
            </div>
          )}

          {nodeId && (
            <div className="flex flex-col items-end">
              {isGeneratingCards && !isMobile && (
                <span className="text-[10px] text-indigo-500 animate-pulse flex items-center gap-1">
                  <Sparkles size={10} /> 正在生成挑战题...
                </span>
              )}
              <button
                onClick={handleStartChallenge}
                disabled={isGeneratingCards}
                className={`flex items-center space-x-2 px-4 lg:px-6 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105 active:scale-95 ${
                  isGeneratingCards ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                <GraduationCap size={18} />
                <span className="hidden sm:inline">完成学习，开始挑战</span>
                <span className="sm:hidden">开始挑战</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Outline Sidebar */}
        <div className={`${
          isMobile 
            ? (!nodeId ? 'w-full' : 'w-0')
            : (isOutlineOpen ? 'w-80' : 'w-0')
        } transition-all duration-300 ease-in-out border-r dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 relative`}>
           <div className={`absolute inset-0 ${isMobile ? 'w-full' : 'w-80'}`}>
             {graphData ? (
               <GraphOutline 
                 nodes={graphData.nodes}
                 edges={graphData.edges}
                 onNodeClick={(node) => navigate(`/learning?graph_id=${graphId}&node_id=${node.id}`)}
                 selectedNodeId={nodeId}
                 selectedNodeIds={selectedNodeIds}
                 onSelectionChange={setSelectedNodeIds}
                 onBatchAction={handleBatchAction}
                 onAddNode={() => setIsCreateNodeModalOpen(true)}
                 className="h-full border-none"
               />
             ) : (
                 <div className="flex items-center justify-center h-full text-slate-400">
                   <Loader2 className="animate-spin mr-2" />
                   加载中...
                 </div>
             )}
           </div>
        </div>

        {/* Content Area */}
        {nodeId ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Article Reader */}
              <div className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? 'p-4' : 'p-8 lg:p-12'} border-r dark:border-slate-800 relative bg-white dark:bg-slate-900`}>
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
                  <div className={`max-w-3xl mx-auto prose ${isMobile ? 'prose-sm' : 'prose-lg'} dark:prose-invert prose-indigo ${isDark ? 'text-slate-50' : 'text-gray-900'}`}>
                    <div className={isMobile ? 'leading-relaxed space-y-4' : ''}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]} 
                        rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                        components={{
                          code: ({ className, children, node }) => (
                            <CodeBlock className={className} isDark={isDark} node={node}>
                              {children}
                            </CodeBlock>
                          ),
                          a: ({node, ...props}) => {
                            const { href, children } = props;
                            if (href && href.startsWith('term:')) {
                                const explanation = href.replace('term:', '');
                                return <TermTooltip term={String(children)} explanation={decodeURIComponent(explanation)} />;
                            }
                            return <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
                          }
                        }}
                      >
                        {preprocessMarkdown(articleContent)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: AI Tutor */}
              <AnimatePresence>
                {isChatOpen && (
                  <>
                    {/* Mobile Backdrop */}
                    {isMobile && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsChatOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
                      />
                    )}
                    <motion.div
                      initial={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
                      animate={isMobile ? { x: 0 } : { width: 384, opacity: 1 }}
                      exit={isMobile ? { x: '100%' } : { width: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className={`
                        ${isMobile ? 'fixed inset-y-0 right-0 z-50 w-[85%] max-w-sm shadow-2xl' : 'relative h-full border-l'} 
                        flex flex-col dark:border-slate-800 ${isDark ? 'bg-slate-900' : 'bg-white'}
                      `}
                    >
                      {/* Chat Header */}
                      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            {rightPanelMode === 'chat' ? <Bot size={18} /> : <Route size={18} />}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">{rightPanelMode === 'chat' ? 'AI 助教' : '学习路径'}</h3>
                            <div className="flex items-center text-[10px] text-green-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></span>
                              {rightPanelMode === 'chat' ? '在线' : 'AI 驱动'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="flex gap-1 mr-2">
                            <button
                              onClick={() => setRightPanelMode('chat')}
                              className={`p-1.5 rounded-md transition-colors ${
                                rightPanelMode === 'chat'
                                  ? 'bg-indigo-500 text-white'
                                  : (isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500')
                              }`}
                              title="AI 助教"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={() => setRightPanelMode('learning-path')}
                              className={`p-1.5 rounded-md transition-colors ${
                                rightPanelMode === 'learning-path'
                                  ? 'bg-indigo-500 text-white'
                                  : (isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500')
                              }`}
                              title="学习路径"
                            >
                              <Route size={14} />
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              if (rightPanelMode === 'chat') {
                                setMessages([{ id: 'welcome', role: 'assistant', content: '你好！我是你的专属学习导师。' }]);
                              }
                            }}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            title={rightPanelMode === 'chat' ? "清空对话" : "刷新路径"}
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button 
                            onClick={() => setIsChatOpen(false)}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {rightPanelMode === 'learning-path' ? (
                          <div className="p-4">
                            <LearningPathPanel
                              graphId={graphId || ''}
                              onNodeSelect={(nodeId) => {
                                navigate(`/learning?graph_id=${graphId}&node_id=${nodeId}`);
                              }}
                            />
                          </div>
                        ) : (
                          <div className="p-4 space-y-4">
                            {messages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                    msg.role === 'user' 
                                      ? 'bg-indigo-600 text-white' 
                                      : (isDark ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'bg-white text-indigo-600 border border-gray-100 shadow-sm')
                                  }`}>
                                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                  </div>
                                  <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === 'user'
                                      ? 'bg-indigo-600 text-white rounded-tr-none'
                                      : (isDark ? 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700' : 'bg-gray-50 text-gray-800 rounded-tl-none border border-gray-100')
                                  }`}>
                                    {msg.isStreaming && !msg.content ? (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                      </div>
                                    ) : (
                                      <div className="prose prose-sm dark:prose-invert prose-indigo max-w-none">
                                        <ReactMarkdown 
                                          remarkPlugins={[remarkGfm, remarkMath]}
                                          rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                                          components={{
                                            code: ({ className, children, node }) => (
                                              <CodeBlock className={className} isDark={isDark} node={node}>
                                                {children}
                                              </CodeBlock>
                                            ),
                                            a: ({node, ...props}) => {
                                              const { href, children } = props;
                                              if (href && href.startsWith('term:')) {
                                                  const explanation = href.replace('term:', '');
                                                  return <TermTooltip term={String(children)} explanation={decodeURIComponent(explanation)} />;
                                              }
                                              return <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
                                            }
                                          }}
                                        >
                                          {msg.role === 'assistant' ? preprocessMarkdown(msg.content) : msg.content}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>

                      {/* Chat Input - Only show in chat mode */}
                      {rightPanelMode === 'chat' && (
                        <div className="p-4 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                          <form onSubmit={handleChatSubmit} className="relative">
                            <textarea
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleChatSubmit(e);
                                }
                              }}
                              placeholder="有问题尽管问我..."
                              className={`w-full p-3 pr-20 pl-4 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                                isDark ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700' : 'bg-white text-gray-900 placeholder-gray-400 border-gray-200'
                              } border`}
                              rows={2}
                            />
                            <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={toggleListening}
                                className={`p-2 rounded-lg transition-all ${
                                  isListening 
                                    ? 'bg-red-500 text-white animate-pulse' 
                                    : (isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-indigo-400' : 'text-gray-400 hover:bg-gray-100 hover:text-indigo-600')
                                }`}
                                title={isListening ? "停止录音" : "语音提问"}
                              >
                                {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                              </button>
                              <button
                                type="submit"
                                disabled={!input.trim() || isChatLoading}
                                className={`p-2 rounded-lg transition-all ${
                                  input.trim() && !isChatLoading
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                                }`}
                              >
                                {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                              </button>
                            </div>
                          </form>
                          <p className={`text-[10px] mt-2 text-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            由 AI 导师提供支持，内容仅供参考
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className={`${isMobile ? 'hidden' : 'flex-1'} flex items-center justify-center text-slate-400 p-8 text-center`}>
            <div className="max-w-md">
              <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center ${
                isDark ? 'bg-slate-800 text-slate-700' : 'bg-gray-100 text-gray-300'
              }`}>
                <BookOpen size={40} />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-900'}`}>开始您的学习之旅</h2>
              <p className="mb-8">从左侧大纲中选择一个知识点，AI 将为您生成专属的学习教材和练习题。</p>
            </div>
          </div>
        )}
      </div>
      {/* Modal */}
      <GenerateCardsModal
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onGenerate={handleManualGenerateCards}
        nodeTitle={nodeTitle}
      />

      {/* Create Node Modal */}
      {isCreateNodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} rounded-xl shadow-2xl w-full max-w-md mx-4 border`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>创建新节点</h3>
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    节点标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    placeholder="输入节点标题"
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    节点内容
                  </label>
                  <textarea
                    value={newNodeContent}
                    onChange={(e) => setNewNodeContent(e.target.value)}
                    placeholder="输入节点内容（可选）"
                    rows={4}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    节点等级
                  </label>
                  <select
                    value={newNodeLevel}
                    onChange={(e) => setNewNodeLevel(e.target.value as NodeLevel)}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="root">根节点</option>
                    <option value="core">核心</option>
                    <option value="sub">次级</option>
                    <option value="normal">普通</option>
                    <option value="leaf">叶子</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                    父节点（可选）
                  </label>
                  <select
                    value={selectedParentNodeId}
                    onChange={(e) => setSelectedParentNodeId(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                      isDark 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">无父节点</option>
                    {graphData?.nodes.map(node => (
                      <option key={node.id} value={node.id}>{node.knowledge_point?.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreateNodeModalOpen(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    isDark 
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateNode}
                  disabled={!newNodeTitle.trim()}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    !newNodeTitle.trim()
                      ? 'opacity-50 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <Plus size={18} />
                  创建节点
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
