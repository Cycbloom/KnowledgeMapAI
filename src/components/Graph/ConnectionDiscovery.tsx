import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Link2, Sparkles, Loader2, X, RefreshCw, Network, Lightbulb } from 'lucide-react';
import { useTheme } from "../../hooks";
import { Node, Edge } from '../../types';
import { EmptyState } from '../common/EmptyState';

interface SuggestedConnection {
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  reason: string;
  score: number;
}

interface ConnectionDiscoveryProps {
  nodes: Node[];
  edges: Edge[];
  graphId: string;
  onConnect: (sourceId: string, targetId: string) => void;
  selectedNodeId?: string;
}

export const ConnectionDiscovery: React.FC<ConnectionDiscoveryProps> = ({
  nodes,
  edges,
  onConnect,
  selectedNodeId
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<SuggestedConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const existingConnections = useMemo(() => {
    const connections = new Set<string>();
    edges.forEach(edge => {
      connections.add(`${edge.source_knowledge_point_id}-${edge.target_knowledge_point_id}`);
      connections.add(`${edge.target_knowledge_point_id}-${edge.source_knowledge_point_id}`);
    });
    return connections;
  }, [edges]);

  const findSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const suggestions: SuggestedConnection[] = [];
      
      // 预构建邻接索引,将每个节点的 connectedIds 从重复 O(edges) 扫描降为一次性 O(edges) 构建
      const adjacencyMap = new Map<string, Set<string>>();
      for (const e of edges) {
        const s = e.source_knowledge_point_id;
        const tgt = e.target_knowledge_point_id;
        let set = adjacencyMap.get(s);
        if (!set) { set = new Set(); adjacencyMap.set(s, set); }
        set.add(tgt);
        set = adjacencyMap.get(tgt);
        if (!set) { set = new Set(); adjacencyMap.set(tgt, set); }
        set.add(s);
      }

      nodes.forEach(node => {
        const nodeTags = new Set(node.tags || node.properties?.tags || []);
        const nodeContent = (node.content || '').toLowerCase();
        const connectedIds = adjacencyMap.get(node.id) ?? new Set<string>();
        
        nodes.forEach(otherNode => {
          if (node.id === otherNode.id) return;
          if (connectedIds.has(otherNode.id)) return;
          if (existingConnections.has(`${node.id}-${otherNode.id}`)) return;
          
          const connectionKey = [node.id, otherNode.id].sort().join('-');
          if (dismissedIds.has(connectionKey)) return;
          
          let score = 0;
          const reasons: string[] = [];
          
          const otherTags = new Set(otherNode.tags || otherNode.properties?.tags || []);
          const commonTags = [...nodeTags].filter(t => otherTags.has(t));
          if (commonTags.length > 0) {
            score += commonTags.length * 10;
            reasons.push(t('graphMap.connectionDiscovery.commonTags', { tags: commonTags.slice(0, 3).join(', ') }));
          }
          
          const otherContent = (otherNode.content || '').toLowerCase();
          const titleInContent = nodeContent.includes(otherNode.title.toLowerCase()) || 
                                  otherContent.includes(node.title.toLowerCase());
          if (titleInContent) {
            score += 15;
            reasons.push(t('graphMap.connectionDiscovery.mentionTitle'));
          }
          
          const commonWords = nodeContent.split(/\s+/).filter(word => 
            word.length > 3 && otherContent.includes(word)
          );
          if (commonWords.length > 3) {
            score += 5;
            reasons.push(t('graphMap.connectionDiscovery.contentSimilarity'));
          }
          
          if (node.level === 'root' && otherNode.level === 'core') {
            score += 3;
          } else if (node.level === 'core' && otherNode.level === 'sub') {
            score += 3;
          }
          
          if (score >= 10) {
            suggestions.push({
              sourceId: node.id,
              sourceTitle: node.title,
              targetId: otherNode.id,
              targetTitle: otherNode.title,
              reason: reasons[0] || t('graphMap.connectionDiscovery.possiblyRelated'),
              score
            });
          }
        });
      });
      
      // 预构建已见过的无向连接 key 集合，替代 filter+arr.findIndex 去重的 O(n²) 扫描（降为 O(n)）
      const seenConnKeys = new Set<string>();
      const uniqueSuggestions = suggestions
        .filter((s) => {
          const key = [s.sourceId, s.targetId].sort().join('|');
          if (seenConnKeys.has(key)) return false;
          seenConnKeys.add(key);
          return true;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setSuggestions(uniqueSuggestions);
    } catch (err) {
      console.error('Failed to find suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, existingConnections, dismissedIds, t]);

  useEffect(() => {
    if (nodes.length > 1) {
      findSuggestions();
    }
  }, [nodes.length, edges.length]);

  const handleConnect = useCallback(async (suggestion: SuggestedConnection) => {
    const connectionKey = [suggestion.sourceId, suggestion.targetId].sort().join('-');
    setConnectingIds(prev => new Set([...prev, connectionKey]));
    
    try {
      await onConnect(suggestion.sourceId, suggestion.targetId);
      setSuggestions(prev => prev.filter(s => 
        !(s.sourceId === suggestion.sourceId && s.targetId === suggestion.targetId)
      ));
    } catch (err) {
      console.error('Failed to connect:', err);
    } finally {
      setConnectingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionKey);
        return next;
      });
    }
  }, [onConnect]);

  const handleDismiss = useCallback((suggestion: SuggestedConnection) => {
    const connectionKey = [suggestion.sourceId, suggestion.targetId].sort().join('-');
    setDismissedIds(prev => new Set([...prev, connectionKey]));
    setSuggestions(prev => prev.filter(s => 
      !(s.sourceId === suggestion.sourceId && s.targetId === suggestion.targetId)
    ));
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!selectedNodeId) return suggestions;
    return suggestions.filter(s => 
      s.sourceId === selectedNodeId || s.targetId === selectedNodeId
    );
  }, [suggestions, selectedNodeId]);

  return (
    <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network size={18} className="text-primary-500" />
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {t('graphMap.connectionDiscovery.title')}
          </h3>
        </div>
        <button
          onClick={findSuggestions}
          disabled={loading}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
            transition-colors
            ${isDark 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
          `}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('graphMap.connectionDiscovery.refresh')}
        </button>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        {t('graphMap.connectionDiscovery.description')}
      </p>

      {loading ? (
        <div className={`flex items-center justify-center py-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <Loader2 size={24} className="animate-spin mr-2" />
          {t('graphMap.connectionDiscovery.analyzing')}
        </div>
      ) : filteredSuggestions.length > 0 ? (
        <div className="space-y-3">
          {filteredSuggestions.map((suggestion, idx) => {
            const connectionKey = [suggestion.sourceId, suggestion.targetId].sort().join('-');
            const isConnecting = connectingIds.has(connectionKey);
            
            return (
              <div
                key={`${suggestion.sourceId}-${suggestion.targetId}-${idx}`}
                className={`
                  p-4 rounded-xl border transition-all
                  ${isDark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-100 bg-gray-50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                        {suggestion.sourceTitle}
                      </span>
                      <Link2 size={14} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                      <span className={`font-medium truncate ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                        {suggestion.targetTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                        {suggestion.reason}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isDark ? 'bg-primary-900/30 text-primary-400' : 'bg-primary-100 text-primary-600'
                      }`}>
                        {t('graphMap.connectionDiscovery.relatedScore', { score: suggestion.score })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleConnect(suggestion)}
                      disabled={isConnecting}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                        transition-all
                        ${isConnecting
                          ? isDark ? 'bg-slate-600 text-slate-400' : 'bg-gray-200 text-gray-400'
                          : 'bg-primary-500 text-white hover:bg-primary-600'}
                      `}
                    >
                      {isConnecting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Link2 size={14} />
                      )}
                      {t('graphMap.connectionDiscovery.connect')}
                    </button>
                    <button
                      onClick={() => handleDismiss(suggestion)}
                      aria-label={t('common.aria.close')}
                      className={`
                        p-1.5 rounded-lg transition-colors
                        ${isDark
                          ? 'text-slate-400 hover:bg-slate-600'
                          : 'text-gray-400 hover:bg-gray-200'}
                      `}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Lightbulb size={32} />}
          title={t('graphMap.empty.connectionDiscovery')}
        />
      )}
    </div>
  );
};

export const NodeConnectionSuggestions: React.FC<{
  node: Node;
  allNodes: Node[];
  edges: Edge[];
  onConnect: (targetId: string) => void;
}> = ({ node, allNodes, edges, onConnect }) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  
  const suggestions = useMemo(() => {
    const connectedIds = new Set(
      edges
        .filter(e => e.source_knowledge_point_id === node.id || e.target_knowledge_point_id === node.id)
        .map(e => e.source_knowledge_point_id === node.id ? e.target_knowledge_point_id : e.source_knowledge_point_id)
    );
    
    const nodeTags = new Set(node.tags || node.properties?.tags || []);
    const nodeContent = (node.content || '').toLowerCase();
    
    return allNodes
      .filter(n => n.id !== node.id && !connectedIds.has(n.id))
      .map(other => {
        let score = 0;
        
        const otherTags = new Set(other.tags || other.properties?.tags || []);
        const commonTags = [...nodeTags].filter((t): t is string => otherTags.has(t));
        score += commonTags.length * 10;
        
        const otherContent = (other.content || '').toLowerCase();
        if (nodeContent.includes(other.title.toLowerCase()) || otherContent.includes(node.title.toLowerCase())) {
          score += 15;
        }
        
        return { node: other, score, commonTags };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [node, allNodes, edges]);

  if (suggestions.length === 0) return null;

  return (
    <div className={`mt-4 p-4 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-primary-500" />
        <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          {t('graphMap.connectionDiscovery.suggestRelation')}
        </span>
      </div>
      
      <div className="space-y-2">
        {suggestions.map(({ node: other, score: _score, commonTags }) => (
          <button
            key={other.id}
            onClick={() => onConnect(other.id)}
            className={`
              w-full text-left p-2 rounded-lg flex items-center justify-between
              transition-colors
              ${isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}
            `}
          >
            <div>
              <span className={`text-sm ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                {other.title}
              </span>
              {commonTags.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {commonTags.slice(0, 2).map(tag => (
                    <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isDark ? 'bg-slate-600 text-slate-300' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link2 size={14} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
          </button>
        ))}
      </div>
    </div>
  );
};
