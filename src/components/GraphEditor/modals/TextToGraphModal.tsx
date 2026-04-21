import React, { useState, useMemo, useRef } from 'react';
import { X, Wand2, Loader2, Check, ArrowLeft, Network, FileText, Upload, Globe, Link, Image as ImageIcon, WifiOff } from 'lucide-react';
import { parseMarkdownToGraph } from '../../../utils/markdownParser';
import { parseOpmlToGraph } from '../../../utils/opmlParser';
import { useTextToGraphMutation, useDocumentToGraphMutation, useImageToGraphMutation } from '../../../hooks/mutations';
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { api } from '../../../services/api';
import { useNetworkStatus } from "../../../hooks";

interface TextToGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  initialData?: { nodes: PreviewNode[], edges: PreviewEdge[] } | null;
  aiEnabled?: boolean;
}

type PreviewNode = {
  id: string;
  title: string;
  content: string;
  level: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
};

type PreviewEdge = {
  source: string;
  target: string;
  relationship: string;
};

export const TextToGraphModal: React.FC<TextToGraphModalProps> = ({ isOpen, onClose, graphId, initialData, aiEnabled }) => {
  const [step, setStep] = useState<'input' | 'preview'>(initialData ? 'preview' : 'input');
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'url' | 'image'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [previewData, setPreviewData] = useState<{ nodes: PreviewNode[], edges: PreviewEdge[] } | null>(initialData || null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set(initialData?.nodes.map(n => n.id) || []));
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const textToGraphMutation = useTextToGraphMutation();
  const documentToGraphMutation = useDocumentToGraphMutation();
  const imageToGraphMutation = useImageToGraphMutation();
  const isOnline = useNetworkStatus();

  const isAnalyzing = textToGraphMutation.isPending || documentToGraphMutation.isPending || imageToGraphMutation.isPending || isUrlLoading;

  // Update state if initialData changes (e.g., when a new PDF is parsed)
  React.useEffect(() => {
    if (initialData) {
      setPreviewData(initialData);
      setSelectedNodeIds(new Set(initialData.nodes.map(n => n.id)));
      setStep('preview');
    }
  }, [initialData]);

  // Group nodes by level for display
  const nodesByLevel = useMemo(() => {
    if (!previewData?.nodes) return {};
    const groups: Record<string, PreviewNode[]> = { root: [], core: [], sub: [], normal: [], leaf: [] };
    previewData.nodes.forEach(node => {
      const level = node.level || 'leaf';
      if (groups[level]) groups[level].push(node);
      else groups['leaf'].push(node);
    });
    return groups;
  }, [previewData]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    let contentToAnalyze = text;

    if (activeTab === 'url') {
      if (!isOnline) {
        frontendEventBus.publish("message_show", { type: 'error', content: '离线模式下无法解析 URL' });
        return;
      }
      if (!url.trim()) {
        frontendEventBus.publish("message_show", { type: 'error', content: '请输入有效的 URL' });
        return;
      }
      try {
        setIsUrlLoading(true);
        // Call backend to fetch URL content
        // Assuming we will implement this endpoint
        const res = await api.ai.urlToText(url);
        contentToAnalyze = res.text;
        if (!contentToAnalyze) throw new Error('无法从该 URL 提取内容');
      } catch (err: any) {
        console.error(err);
        frontendEventBus.publish("message_show", { type: 'error', content: err.message || 'URL 解析失败' });
        setIsUrlLoading(false);
        return;
      } finally {
        setIsUrlLoading(false);
      }
    } else if (!contentToAnalyze.trim()) {
      frontendEventBus.publish("message_show", { type: 'error', content: '请输入文本内容' });
      return;
    }
    
    if (contentToAnalyze.length < 10) {
      frontendEventBus.publish("message_show", { type: 'error', content: '内容太短，至少需要10个字符' });
      return;
    }

    if (!isOnline) {
      frontendEventBus.publish("message_show", { type: 'error', content: '离线模式下无法使用 AI 分析' });
      return;
    }

    try {
      if (aiEnabled === false) {
        frontendEventBus.publish("message_show", { type: 'warning', content: 'AI 未配置：本次将生成模拟预览' });
      }
      const result = await textToGraphMutation.mutateAsync({ 
        text: contentToAnalyze, 
        graph_id: graphId, 
        action: 'analyze'
      });
      
      setPreviewData(result);
      // Select all by default
      if (result.nodes) {
        setSelectedNodeIds(new Set(result.nodes.map((n: any) => n.id)));
      }
      setStep('preview');
      frontendEventBus.publish("message_show", { type: 'success', content: 'AI 分析完成，请确认生成内容' });
    } catch (error: any) {
      console.error(error);
      frontendEventBus.publish("message_show", { type: 'error', content: error.message || '分析失败，请重试' });
    }
  };

  const processImage = async (file: File) => {
    if (!isOnline) {
      frontendEventBus.publish("message_show", { type: 'error', content: '离线模式下无法使用图片识别' });
      return;
    }

    if (aiEnabled === false) {
      frontendEventBus.publish("message_show", { type: 'error', content: 'AI 未配置：图片识别需要配置 AI Key (推荐使用 Aliyun/Volcengine)' });
      return;
    }

    frontendEventBus.publish("message_show", { type: 'info', content: '正在分析图片内容...' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Optional: Pass provider preference if needed, but backend handles default
      
      const result = await imageToGraphMutation.mutateAsync(formData);

      if (!result.nodes || result.nodes.length === 0) {
        throw new Error('AI 未能从图片中识别出有效节点。');
      }

      setPreviewData(result);
      setSelectedNodeIds(new Set(result.nodes.map((n: any) => n.id)));
      setStep('preview');
      frontendEventBus.publish("message_show", { type: 'success', content: '图片分析成功' });
    } catch (err: any) {
      console.error(err);
      frontendEventBus.publish("message_show", { type: 'error', content: err.message || '分析失败' });
    }
  };

  const processFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
        await processImage(file);
        return;
    }

    if (file.name.endsWith('.pdf')) {
        if (!isOnline) {
          frontendEventBus.publish("message_show", { type: 'error', content: '离线模式下无法解析 PDF' });
          return;
        }

        if (aiEnabled === false) {
          frontendEventBus.publish("message_show", { type: 'error', content: 'AI 未配置：PDF 解析不可用，请先配置 AI Key' });
          return;
        }

        frontendEventBus.publish("message_show", { type: 'info', content: '正在解析 PDF 文档...' });

        try {
          const result = await documentToGraphMutation.mutateAsync({
            graph_id: graphId,
            file
          });
          
          if (!result.nodes || result.nodes.length === 0) {
            throw new Error('AI 未能从文档中解析出任何节点，请检查文档内容。');
          }

          setPreviewData(result);
          setSelectedNodeIds(new Set(result.nodes.map((n: any) => n.id)));
          setStep('preview');
          frontendEventBus.publish("message_show", { type: 'success', content: '文档解析成功' });
        } catch (err: any) {
          console.error(err);
          frontendEventBus.publish("message_show", { type: 'error', content: err.message || '解析失败' });
        }
    } else {
       // Local parsing for MD/OPML/TXT
       const reader = new FileReader();
       reader.onload = async (e) => {
         try {
           const content = e.target?.result as string;
           let parsed;

           if (file.name.endsWith('.opml')) {
             parsed = parseOpmlToGraph(content);
           } else if (file.name.endsWith('.md')) {
             parsed = parseMarkdownToGraph(content);
           } else {
             // TXT: Switch to text tab and fill content
             setText(content);
             setActiveTab('text');
             frontendEventBus.publish("message_show", { type: 'success', content: '文本已导入编辑器' });
             return;
           }

           // Convert parsed format to preview format
           const previewNodes = parsed.nodes.map((n: any) => ({
             id: n.id,
             title: n.title,
             content: n.content,
             level: n.level || 'leaf'
           }));
           
           const previewEdges = parsed.edges.map((e: any) => ({
             source: e.source,
             target: e.target,
             relationship: e.relationship || 'related'
           }));

           setPreviewData({ nodes: previewNodes, edges: previewEdges });
           setSelectedNodeIds(new Set(previewNodes.map(n => n.id)));
           setStep('preview');
           frontendEventBus.publish("message_show", { type: 'success', content: '文件解析成功' });
         } catch (err: any) {
           console.error(err);
           frontendEventBus.publish("message_show", { type: 'error', content: `解析失败: ${  err.message}` });
         }
       };
       reader.readAsText(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Check file type
      const validExtensions = ['.pdf', '.txt', '.md', '.opml', '.png', '.jpg', '.jpeg', '.webp'];
      const isValid = validExtensions.some(type => file.name.toLowerCase().endsWith(type));
      if (!isValid) {
        frontendEventBus.publish("message_show", { type: 'error', content: '不支持的文件格式。请上传 PDF, Markdown, OPML, TXT 或 图片文件。' });
        return;
      }
      await processFile(file);
    }
  };

  const handleSave = async () => {
    if (!previewData) return;

    try {
      // Filter nodes
      const nodesToSave = previewData.nodes.filter(n => selectedNodeIds.has(n.id));
      
      // Filter edges: both source and target must be in selected nodes
      const edgesToSave = previewData.edges.filter(e => 
        selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
      );

      if (nodesToSave.length === 0) {
        frontendEventBus.publish("message_show", { type: 'error', content: '请至少选择一个节点' });
        return;
      }

      await textToGraphMutation.mutateAsync({ 
        graph_id: graphId, 
        action: 'save',
        nodes: nodesToSave,
        edges: edgesToSave
      });

      frontendEventBus.publish("message_show", { type: 'success', content: `成功生成 ${nodesToSave.length} 个节点和 ${edgesToSave.length} 条关系！` });
      handleClose();
    } catch (error: any) {
      console.error(error);
      frontendEventBus.publish("message_show", { type: 'error', content: error.message || '保存失败，请重试' });
    }
  };

  const handleClose = () => {
    setStep('input');
    setText('');
    setUrl('');
    setActiveTab('text');
    setPreviewData(null);
    setSelectedNodeIds(new Set());
    onClose();
  };

  const toggleNode = (id: string) => {
    const newSet = new Set(selectedNodeIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedNodeIds(newSet);
  };

  const toggleAll = () => {
    if (!previewData) return;
    if (selectedNodeIds.size === previewData.nodes.length) {
      setSelectedNodeIds(new Set());
    } else {
      setSelectedNodeIds(new Set(previewData.nodes.map(n => n.id)));
    }
  };

  const levelLabels: Record<string, string> = {
    root: '🟣 核心主题 (Root)',
    core: '🔴 主要概念 (Core)',
    sub: '🟠 细分知识 (Sub)',
    normal: '🔵 具体内容 (Normal)',
    leaf: '🟢 实例细节 (Leaf)'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-white">
          <div className="flex items-center space-x-2 text-primary-700">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Wand2 size={20} />
            </div>
            <h2 className="text-lg font-bold">
              {step === 'input' ? 'AI 知识图谱生成' : '预览与筛选生成的图谱'}
            </h2>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
          {step === 'input' ? (
            <div className="space-y-4 h-full flex flex-col">
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg self-start">
                <button
                  onClick={() => setActiveTab('text')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'text' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText size={16} />
                  <span>文本输入</span>
                </button>
                <button
                  onClick={() => setActiveTab('file')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'file' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Upload size={16} />
                  <span>文件上传</span>
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'image' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ImageIcon size={16} />
                  <span>图片识别</span>
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'url' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Globe size={16} />
                  <span>网页链接</span>
                </button>
              </div>

              {aiEnabled === false && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
                  AI 未配置：文本分析会生成模拟预览；文档上传与 URL 解析需要配置 AI Key。
                </div>
              )}
              
              <div className="flex-1 min-h-[300px] flex flex-col">
                {activeTab === 'text' && (
                  <div className="relative group flex-1">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="例如：太阳系是以太阳为中心，和所有受到太阳的引力约束天体的集合体。包括八大行星..."
                      className="w-full h-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none text-base leading-relaxed transition-all group-hover:border-gray-300"
                      disabled={isAnalyzing}
                    />
                    <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                      {text.length} 字符
                    </div>
                  </div>
                )}

                {activeTab === 'file' && (
                  <div 
                    className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-all ${
                      isDragging 
                        ? 'border-primary-500 bg-primary-50' 
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                      <Upload size={32} className={isDragging ? 'text-primary-500' : 'text-gray-400'} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      {isDragging ? '释放以解析文件' : '点击或拖拽文件到此处'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
                      支持 PDF 文档、Markdown 笔记、OPML 大纲或纯文本文件。
                      <br />
                      <span className="text-xs opacity-70">AI 将自动提取内容并生成知识图谱。</span>
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:text-primary-600 transition-colors shadow-sm"
                      disabled={isAnalyzing}
                    >
                      选择文件
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".pdf,.txt,.md,.opml"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}

                {activeTab === 'image' && (
                  <div 
                    className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-all ${
                      isDragging 
                        ? 'border-primary-500 bg-primary-50' 
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                      <ImageIcon size={32} className={isDragging ? 'text-primary-500' : 'text-gray-400'} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      {isDragging ? '释放以识别图片' : '上传图片生成图谱'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
                      支持思维导图截图、流程图、板书照片或幻灯片。
                      <br />
                      <span className="text-xs opacity-70">支持 JPG, PNG, WebP 格式。</span>
                    </p>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:text-primary-600 transition-colors shadow-sm"
                      disabled={isAnalyzing}
                    >
                      选择图片
                    </button>
                    <input 
                      type="file" 
                      ref={imageInputRef} 
                      className="hidden" 
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleImageUpload}
                    />
                  </div>
                )}

                {activeTab === 'url' && (
                  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200 p-8">
                    {!isOnline ? (
                      <div className="text-center text-gray-500">
                        <WifiOff size={48} className="mx-auto mb-4 text-gray-400" />
                        <p className="font-medium">离线模式不可用</p>
                        <p className="text-sm mt-2">URL 解析需要网络连接</p>
                      </div>
                    ) : (
                    <div className="w-full max-w-md space-y-4">
                      <div className="text-center mb-6">
                        <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3">
                          <Globe size={28} className="text-primary-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-800">输入网页链接</h3>
                        <p className="text-sm text-gray-500">AI 将读取网页内容并转化为知识结构</p>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Link size={18} className="text-gray-400" />
                        </div>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com/article"
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          disabled={isAnalyzing}
                        />
                      </div>
                      
                      <div className="bg-primary-50 p-3 rounded-lg text-xs text-primary-700 flex items-start gap-2">
                        <div className="mt-0.5"><Check size={12} /></div>
                        <span>支持博客文章、新闻报道、维基百科条目等以文本为主的网页。</span>
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-2">
                 <p className="text-sm text-gray-500">
                   共生成 {previewData?.nodes.length} 个节点。请勾选您想要保留的节点：
                 </p>
                 <button 
                   onClick={toggleAll}
                   className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                 >
                   {selectedNodeIds.size === previewData?.nodes.length ? '取消全选' : '全选'}
                 </button>
              </div>

              {['root', 'core', 'sub', 'normal', 'leaf'].map(level => {
                const nodes = nodesByLevel[level];
                if (!nodes || nodes.length === 0) return null;

                return (
                  <div key={level} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-medium text-gray-700 text-sm flex justify-between items-center">
                      <span>{levelLabels[level]}</span>
                      <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{nodes.length}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {nodes.map(node => (
                        <div 
                          key={node.id} 
                          className={`p-3 flex items-start space-x-3 hover:bg-gray-50 transition-colors cursor-pointer ${!selectedNodeIds.has(node.id) ? 'opacity-50 grayscale' : ''}`}
                          onClick={() => toggleNode(node.id)}
                        >
                          <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedNodeIds.has(node.id) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'}`}>
                            {selectedNodeIds.has(node.id) && <Check size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">{node.title}</h4>
                            <p className="text-gray-500 text-xs mt-1 line-clamp-2">{node.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
          <div>
            {step === 'preview' && (
               <div className="text-sm text-gray-500">
                 已选择 <span className="font-bold text-primary-600">{selectedNodeIds.size}</span> / {previewData?.nodes.length} 个节点
               </div>
            )}
          </div>
          <div className="flex space-x-3">
            {step === 'input' ? (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={textToGraphMutation.isPending}
              >
                取消
              </button>
            ) : (
              <button
                onClick={() => setStep('input')}
                className="flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                disabled={textToGraphMutation.isPending}
              >
                <ArrowLeft size={18} className="mr-1" />
                返回修改
              </button>
            )}

            {step === 'input' ? (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !text.trim()}
                className="flex items-center space-x-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-lg shadow-primary-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在分析...</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    <span>开始分析</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={textToGraphMutation.isPending || selectedNodeIds.size === 0}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-lg shadow-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {textToGraphMutation.isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在保存...</span>
                  </>
                ) : (
                  <>
                    <Network size={18} />
                    <span>生成图谱</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
