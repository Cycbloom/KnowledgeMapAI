import React, { useState, useMemo, useRef } from 'react';
import { X, Wand2, Loader2, Check, ArrowLeft, Network, FileText, Upload } from 'lucide-react';
import { useTextToGraphMutation, useDocumentToGraphMutation } from '../../hooks/useQueries';
import toast from 'react-hot-toast';

interface TextToGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  initialData?: { nodes: PreviewNode[], edges: PreviewEdge[] } | null;
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

export const TextToGraphModal: React.FC<TextToGraphModalProps> = ({ isOpen, onClose, graphId, initialData }) => {
  const [step, setStep] = useState<'input' | 'preview'>(initialData ? 'preview' : 'input');
  const [text, setText] = useState('');
  const [previewData, setPreviewData] = useState<{ nodes: PreviewNode[], edges: PreviewEdge[] } | null>(initialData || null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set(initialData?.nodes.map(n => n.id) || []));
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const textToGraphMutation = useTextToGraphMutation();
  const documentToGraphMutation = useDocumentToGraphMutation();

  const isAnalyzing = textToGraphMutation.isPending || documentToGraphMutation.isPending;

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
    if (!text.trim()) {
      toast.error('请输入文本内容');
      return;
    }
    
    if (text.length < 10) {
      toast.error('文本内容太短，至少需要10个字符');
      return;
    }

    try {
      const result = await textToGraphMutation.mutateAsync({ 
        text, 
        graph_id: graphId, 
        action: 'analyze' 
      });
      
      setPreviewData(result);
      // Select all by default
      if (result.nodes) {
        setSelectedNodeIds(new Set(result.nodes.map((n: any) => n.id)));
      }
      setStep('preview');
      toast.success('AI 分析完成，请确认生成内容');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '分析失败，请重试');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('正在解析文档并生成预览...');

    try {
      const result = await documentToGraphMutation.mutateAsync({
        graph_id: graphId,
        file: file
      });
      
      if (!result.nodes || result.nodes.length === 0) {
        throw new Error('AI 未能从文档中解析出任何节点，请检查文档内容。');
      }

      setPreviewData(result);
      setSelectedNodeIds(new Set(result.nodes.map((n: any) => n.id)));
      setStep('preview');
      toast.success('文档解析成功', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '解析失败', { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        toast.error('请至少选择一个节点');
        return;
      }

      await textToGraphMutation.mutateAsync({ 
        graph_id: graphId, 
        action: 'save',
        nodes: nodesToSave,
        edges: edgesToSave
      });

      toast.success(`成功生成 ${nodesToSave.length} 个节点和 ${edgesToSave.length} 条关系！`);
      handleClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '保存失败，请重试');
    }
  };

  const handleClose = () => {
    setStep('input');
    setText('');
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
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center space-x-2 text-blue-700">
            <div className="p-2 bg-blue-100 rounded-lg">
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
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <p className="text-gray-600 text-sm">
                  请输入笔记、文章摘要或上传文档，AI 将自动分析知识结构并生成图谱。
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
                  disabled={isAnalyzing}
                >
                  <Upload size={16} />
                  <span>上传文档 (PDF/TXT/MD)</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.txt,.md"
                  onChange={handleFileUpload}
                />
              </div>
              
              <div className="relative group">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="例如：太阳系是以太阳为中心，和所有受到太阳的引力约束天体的集合体。包括八大行星（由离太阳从近到远的顺序：水星、金星、地球、火星、木星、土星、天王星、海王星）、以及至少173颗已知的卫星、5颗已经辨认出来的矮行星和数以亿计的太阳系小天体..."
                  className="w-full h-80 p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-base leading-relaxed transition-all group-hover:border-gray-300"
                  disabled={isAnalyzing}
                />
                <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                  {text.length} 字符
                </div>
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
                   className="text-sm text-blue-600 hover:text-blue-800 font-medium"
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
                          <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedNodeIds.has(node.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
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
                 已选择 <span className="font-bold text-blue-600">{selectedNodeIds.size}</span> / {previewData?.nodes.length} 个节点
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
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
