import { useCallback } from 'react';
import { Node, Edge, NodeLevel, BranchSuggestion } from '../../types';
import { getLevel, getNextLevel, getLevelColorHex } from '../../lib/graphUtils';
import { useMessageStore } from '../../store/useMessageStore';
import { api } from '../../services/api';
import { handleError, isNetworkError } from '../../services/errorService';

interface UseBranchOperationsOptions {
  id: string;
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  state: {
    setLoading: (loading: boolean) => void;
    setExplorationPath: (updater: (prev: any[]) => any[]) => void;
    setCurrentPathIndex: (index: number) => void;
    setHistoricalAlternativeBranches: (updater: (prev: any[]) => any[]) => void;
  };
  mutations: {
    createNodeMutation: any;
    createEdgeMutation: any;
  };
  record: (action: { type: string; payload: any }) => void;
}

export const useBranchOperations = (options: UseBranchOperationsOptions) => {
  const { id, nodes, edges, selectedNode, state, mutations, record } = options;
  const { addMessage } = useMessageStore();

  const handleGetBranchSuggestions = useCallback(async (): Promise<BranchSuggestion[]> => {
    if (!selectedNode || !id) return [];
    state.setLoading(true);
    try {
      const parentLevel = getLevel(selectedNode, edges);
      
      const existingTitles = nodes.map(n => n.title);
      
      const currentChildrenIds = edges
        .filter(e => e.source_node_id === selectedNode.id)
        .map(e => e.target_node_id);
      const currentChildrenTitles = nodes
        .filter(n => currentChildrenIds.includes(n.id))
        .map(n => n.title);

      const res = await api.ai.getBranchSuggestions({
        node_title: selectedNode.title,
        node_content: selectedNode.content,
        existing_nodes: existingTitles,
        child_nodes: currentChildrenTitles,
        context_level: parentLevel
      });

      return res.suggestions || [];
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '获取分支建议失败' });
      return [];
    } finally {
      state.setLoading(false);
    }
  }, [selectedNode, id, state, nodes, edges, addMessage]);

  const handleCreateBranch = useCallback(async (suggestion: BranchSuggestion, isAccepted: boolean = true) => {
    if (!selectedNode || !id) return null;
    state.setLoading(true);
    try {
      const parentLevel = getLevel(selectedNode, edges);
      const newLevel = getNextLevel(parentLevel);

      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 4;
      const x = Math.round(selectedNode.x_position + Math.cos(angle) * radius);
      const y = Math.round(selectedNode.y_position + Math.sin(angle) * radius);

      const newNode = await mutations.createNodeMutation.mutateAsync({
        graph_id: id,
        title: suggestion.title,
        content: suggestion.description,
        x_position: x,
        y_position: y,
        color: getLevelColorHex(newLevel),
        level: newLevel,
        is_accepted: isAccepted,
        properties: {
          branchSuggestionId: suggestion.id,
          priority: suggestion.priority,
          estimatedDifficulty: suggestion.estimatedDifficulty,
          relatedTopics: suggestion.relatedTopics
        }
      });

      record({ type: 'CREATE_NODE', payload: newNode });
      const newEdge = await mutations.createEdgeMutation.mutateAsync({
        source_node_id: selectedNode.id,
        target_node_id: newNode.id,
        relationship_type: 'branch',
        graphId: id
      });
      record({ type: 'CREATE_EDGE', payload: newEdge });
      addMessage({ type: 'success', content: `已创建分支：${suggestion.title}` });
      return newNode;
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '创建分支失败' });
      return null;
    } finally {
      state.setLoading(false);
    }
  }, [selectedNode, id, state, mutations, record, edges, addMessage]);

  const handleSwitchBranch = useCallback(async (pathItem: any, suggestion: BranchSuggestion) => {
    if (!id) return;
    state.setLoading(true);
    try {
      const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
      if (!parentNode) return;

      const branches = pathItem.alternativeBranches || [];
      const createdNodes: any[] = [];

      for (const branch of branches) {
        const isAccepted = branch.id === suggestion.id;
        const newNode = await mutations.createNodeMutation.mutateAsync({
          graph_id: id,
          title: branch.title,
          content: branch.description,
          x_position: parentNode.x_position + (Math.random() - 0.5) * 8,
          y_position: parentNode.y_position + (Math.random() - 0.5) * 8,
          color: getLevelColorHex(getLevel(parentNode, edges)),
          level: getLevel(parentNode, edges),
          is_accepted: isAccepted,
          properties: {
            branchSuggestionId: branch.id,
            priority: branch.priority,
            estimatedDifficulty: branch.estimatedDifficulty,
            relatedTopics: branch.relatedTopics
          }
        });

        record({ type: 'CREATE_NODE', payload: newNode });
        const newEdge = await mutations.createEdgeMutation.mutateAsync({
          source_node_id: parentNode.id,
          target_node_id: newNode.id,
          relationship_type: 'branch',
          graphId: id
        });
        record({ type: 'CREATE_EDGE', payload: newEdge });
        createdNodes.push({ node: newNode, suggestion: branch, isAccepted });
      }

      const selectedNodeData = createdNodes.find(n => n.isAccepted);
      if (selectedNodeData) {
        state.setExplorationPath(prev => {
          const newPath = [...prev];
          const currentIndex = newPath.findIndex((item: any) => item.nodeId === pathItem.parentNodeId);
          if (currentIndex !== -1) {
            newPath[currentIndex] = {
              nodeId: selectedNodeData.node.id,
              nodeTitle: selectedNodeData.node.title,
              timestamp: new Date(),
              branchChoice: selectedNodeData.suggestion.title,
              parentNodeId: parentNode.id,
              branchSuggestionId: selectedNodeData.suggestion.id,
              alternativeBranches: branches
            };
            state.setCurrentPathIndex(currentIndex);
          }
          return newPath;
        });

        state.setHistoricalAlternativeBranches(prev => [
          ...prev.filter((item: any) => item.nodeId !== parentNode.id),
          {
            nodeId: parentNode.id,
            branches,
            selectedBranchId: suggestion.id
          }
        ]);

        addMessage({ type: 'success', content: `已切换分支：${suggestion.title}` });
      }
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '切换分支失败' });
    } finally {
      state.setLoading(false);
    }
  }, [id, nodes, edges, state, mutations, record, addMessage]);

  return {
    handleGetBranchSuggestions,
    handleCreateBranch,
    handleSwitchBranch
  };
};
