import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, CheckCircle2, Network, Layers, Link2, TrendingUp, Activity, X } from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Node } from '../../types';

interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  isolatedNodes: string[];
  disconnectedComponents: number;
  maxDepth: number;
  avgDepth: number;
  levelDistribution: Record<string, number>;
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  centralNodes: Array<{ id: string; degree: number; title: string }>;
  rootNodes: string[];
  leafNodes: string[];
  nodesWithoutContent: string[];
  nodesWithManyChildren: Array<{ id: string; childrenCount: number; title: string }>;
  healthScore: number;
  healthIssues: string[];
}

interface MissingConnection {
  sourceId: string;
  targetId: string;
  reason: string;
}

interface GraphAnalysisPanelProps {
  graphId: string;
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
  onCreateConnection?: (sourceId: string, targetId: string) => void;
}

export const GraphAnalysisPanel: React.FC<GraphAnalysisPanelProps> = ({
  graphId,
  isOpen,
  onClose,
  nodes,
  onNodeClick,
  onCreateConnection
}) => {
  const { addMessage } = useMessageStore();
  const [analysis, setAnalysis] = useState<GraphAnalysis | null>(null);
  const [missingConnections, setMissingConnections] = useState<MissingConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'connections'>('overview');

  useEffect(() => {
    if (isOpen && graphId) {
      loadAnalysis();
    }
  }, [isOpen, graphId]);

  const loadAnalysis = async () => {
    setIsLoading(true);
    try {
      const [analysisData, connectionsData] = await Promise.all([
        api.graphs.analyze(graphId),
        api.graphs.getMissingConnections(graphId)
      ]);
      setAnalysis(analysisData);
      setMissingConnections(connectionsData?.suggestions || []);
    } catch (error: any) {
      addMessage({ 
        type: 'error',
        content: `加载分析数据失败: ${  error.message || '未知错误'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConnection = (sourceId: string, targetId: string) => {
    if (onCreateConnection) {
      onCreateConnection(sourceId, targetId);
      addMessage({ 
        type: 'success',
        content: '连接已创建'
      });
    }
  };

  if (!isOpen) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="text-blue-500" size={20} />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">图谱分析</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                概览
              </button>
              <button
                onClick={() => setActiveTab('structure')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'structure'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                结构分析
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'connections'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                连接建议 ({missingConnections.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : analysis ? (
                <>
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Health Score */}
                      <div className={`p-4 rounded-lg ${getHealthBgColor(analysis.healthScore)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Activity className={getHealthColor(analysis.healthScore)} size={20} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">健康度评分</span>
                          </div>
                          <span className={`text-2xl font-bold ${getHealthColor(analysis.healthScore)}`}>
                            {analysis.healthScore}/100
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {analysis.healthIssues.map((issue, idx) => (
                            <div key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              {issue.includes('健康') ? (
                                <CheckCircle2 className="text-green-500" size={14} />
                              ) : (
                                <AlertTriangle className="text-orange-500" size={14} />
                              )}
                              {issue}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Basic Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">节点数</div>
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysis.nodeCount}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">连接数</div>
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysis.edgeCount}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">平均深度</div>
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysis.avgDepth}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">平均连接度</div>
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysis.avgDegree}</div>
                        </div>
                      </div>

                      {/* Level Distribution */}
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="text-blue-500" size={18} />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">层级分布</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(analysis.levelDistribution).map(([level, count]) => (
                            <div key={level} className="text-center">
                              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{count}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{level}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'structure' && (
                    <div className="space-y-4">
                      {/* Central Nodes */}
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Network className="text-blue-500" size={18} />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">核心节点 (按连接度排序)</span>
                        </div>
                        <div className="space-y-2">
                          {analysis.centralNodes.map((node, idx) => (
                            <div
                              key={node.id}
                              className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              onClick={() => onNodeClick?.(node.id)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">#{idx + 1}</span>
                                <span className="text-sm text-slate-800 dark:text-slate-200">{node.title}</span>
                              </div>
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{node.degree} 连接</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Nodes with Many Children */}
                      {analysis.nodesWithManyChildren.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="text-blue-500" size={18} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">子节点较多的节点</span>
                          </div>
                          <div className="space-y-2">
                            {analysis.nodesWithManyChildren.map((node) => (
                              <div
                                key={node.id}
                                className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                onClick={() => onNodeClick?.(node.id)}
                              >
                                <span className="text-sm text-slate-800 dark:text-slate-200">{node.title}</span>
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{node.childrenCount} 个子节点</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Issues */}
                      {(analysis.isolatedNodes.length > 0 || analysis.nodesWithoutContent.length > 0) && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="text-amber-500" size={18} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">需要关注的问题</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            {analysis.isolatedNodes.length > 0 && (
                              <div className="text-slate-700 dark:text-slate-300">
                                孤立节点: {analysis.isolatedNodes.length} 个
                              </div>
                            )}
                            {analysis.nodesWithoutContent.length > 0 && (
                              <div className="text-slate-700 dark:text-slate-300">
                                缺少内容的节点: {analysis.nodesWithoutContent.length} 个
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'connections' && (
                    <div className="space-y-3">
                      {missingConnections.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                          <Link2 className="mx-auto mb-2 opacity-50" size={32} />
                          <p>暂无连接建议</p>
                        </div>
                      ) : (
                        missingConnections.map((conn, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onNodeClick?.(conn.sourceId)}
                                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {nodes.find(n => n.id === conn.sourceId)?.title || '未知节点'}
                                </button>
                                <span className="text-slate-400">→</span>
                                <button
                                  onClick={() => onNodeClick?.(conn.targetId)}
                                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {nodes.find(n => n.id === conn.targetId)?.title || '未知节点'}
                                </button>
                              </div>
                              <button
                                onClick={() => handleCreateConnection(conn.sourceId, conn.targetId)}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                              >
                                创建连接
                              </button>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{conn.reason}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  无法加载分析数据
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};