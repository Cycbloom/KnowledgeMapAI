import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Check,
  Settings,
  BookOpen,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler } from '../../hooks/useErrorHandler';

interface AutoGraphGeneratorProps {
  graphId?: string;
  onGraphGenerated?: (nodes: any[], edges: any[]) => void;
  onClose?: () => void;
}

interface GeneratedNode {
  id: string;
  title: string;
  content: string;
  level: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
}

interface GeneratedEdge {
  source: string;
  target: string;
  relationship: string;
}

const styleOptions = [
  { value: 'academic', label: '学术风格', icon: GraduationCap, description: '适合学术研究和理论学习' },
  { value: 'practical', label: '实用风格', icon: Briefcase, description: '适合实际应用和技能学习' },
  { value: 'beginner', label: '入门风格', icon: BookOpen, description: '适合初学者快速入门' },
];

export const AutoGraphGenerator: React.FC<AutoGraphGeneratorProps> = ({
  graphId,
  onGraphGenerated,
  onClose
}) => {
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(3);
  const [style, setStyle] = useState<'academic' | 'practical' | 'beginner'>('academic');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [generatedNodes, setGeneratedNodes] = useState<GeneratedNode[]>([]);
  const [generatedEdges, setGeneratedEdges] = useState<GeneratedEdge[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const handleAddSource = useCallback(() => {
    if (newSource.trim()) {
      setSources(prev => [...prev, newSource.trim()]);
      setNewSource('');
    }
  }, [newSource]);

  const handleRemoveSource = useCallback((index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      addMessage({ type: 'warning', content: '请输入主题' });
      return;
    }

    setIsGenerating(true);
    setProgress('正在分析主题...');
    setGeneratedNodes([]);
    setGeneratedEdges([]);
    setSuggestions([]);

    try {
      const result = await api.autoGraph.generate({
        topic,
        depth,
        style,
        sources: sources.length > 0 ? sources : undefined,
        graph_id: graphId
      });

      if (result.nodes && result.nodes.length > 0) {
        setGeneratedNodes(result.nodes);
        setGeneratedEdges(result.edges || []);
        setSuggestions(result.suggestions || []);
        setProgress(`生成完成：${result.nodes.length} 个节点，${result.edges?.length || 0} 条关系`);
        addMessage({ 
          type: 'success', 
          content: `知识图谱生成成功：${result.nodes.length} 个节点` 
        });
      } else {
        setProgress('未能生成有效节点，请尝试调整主题');
        addMessage({ type: 'warning', content: '未能生成有效节点' });
      }
    } catch (error) {
      handleError(error, { context: 'AutoGraphGenerator', fallbackMessage: '知识图谱生成失败' });
      setProgress('生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, depth, style, sources, graphId, addMessage, handleError]);

  const handleSaveToGraph = useCallback(async () => {
    if (!graphId || generatedNodes.length === 0) return;

    setIsGenerating(true);
    setProgress('正在保存到图谱...');

    try {
      await api.autoGraph.save({
        graph_id: graphId,
        nodes: generatedNodes,
        edges: generatedEdges
      });

      addMessage({ type: 'success', content: '知识图谱已保存' });
      onGraphGenerated?.(generatedNodes, generatedEdges);
      onClose?.();
    } catch (error) {
      handleError(error, { context: 'SaveGraph', fallbackMessage: '保存失败' });
    } finally {
      setIsGenerating(false);
    }
  }, [graphId, generatedNodes, generatedEdges, onGraphGenerated, onClose, addMessage, handleError]);

  const getLevelColor = (level: string) => {
    const colors = {
      root: 'bg-purple-100 text-purple-800 border-purple-200',
      core: 'bg-red-100 text-red-800 border-red-200',
      sub: 'bg-orange-100 text-orange-800 border-orange-200',
      normal: 'bg-blue-100 text-blue-800 border-blue-200',
      leaf: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[level as keyof typeof colors] || colors.normal;
  };

  return (
    <div className="auto-graph-generator bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-full max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI 知识图谱生成器</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">输入主题，AI 自动生成完整的知识图谱</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            主题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：机器学习基础、量子计算入门、区块链技术原理"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            disabled={isGenerating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            生成风格
          </label>
          <div className="grid grid-cols-3 gap-2">
            {styleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setStyle(option.value as any)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    style === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${
                    style === option.value ? 'text-blue-500' : 'text-gray-400'
                  }`} />
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          高级设置
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-4 overflow-hidden"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  生成深度: {depth} 层
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value))}
                  className="w-full"
                  disabled={isGenerating}
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>简洁</span>
                  <span>详细</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  参考来源（可选）
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    placeholder="输入 URL 或文本"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                    disabled={isGenerating}
                  />
                  <button
                    onClick={handleAddSource}
                    disabled={isGenerating || !newSource.trim()}
                    className="px-3 py-2 bg-gray-100 dark:bg-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-500 disabled:opacity-50"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sources.map((source, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-600 rounded text-xs"
                      >
                        {source.slice(0, 30)}...
                        <button
                          onClick={() => handleRemoveSource(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !topic.trim()}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              生成知识图谱
            </>
          )}
        </button>

        {generatedNodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                生成结果
              </h3>
              <span className="text-sm text-gray-500">
                {generatedNodes.length} 个节点 · {generatedEdges.length} 条关系
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              {generatedNodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-2 rounded-lg border ${getLevelColor(node.level)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase opacity-70">
                      {node.level}
                    </span>
                    <span className="font-medium">{node.title}</span>
                  </div>
                  {node.content && (
                    <p className="text-xs mt-1 opacity-80 line-clamp-2">
                      {node.content}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {suggestions.length > 0 && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  AI 建议
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 flex-shrink-0" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {graphId && (
              <button
                onClick={handleSaveToGraph}
                disabled={isGenerating}
                className="w-full py-2 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存到当前图谱
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AutoGraphGenerator;
