import type { Node, Edge, ExtractedConcept, TutorMode } from '../types';
import { getNextLevel, getLevelColorHex } from '../lib/graphUtils';
import { HistoryAction } from './useHistory';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { api } from '../services/api';

interface UseTutorOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: {
    createNodeMutation: any;
    createEdgeMutation: any;
  };
  record: (action: HistoryAction) => void;
}

export const useTutorOperations = ({
  id,
  nodes,
  edges: _edges,
  state,
  mutations,
  record
}: UseTutorOperationsProps) => {
  const { addMessage } = useMessageStore();
  const { 
    tutorMode, setTutorMode,
    extractedConcepts, setExtractedConcepts,
    isTutorMode, setIsTutorMode,
    _suggestedNextTopics, setSuggestedNextTopics,
    selectedNode,
    selectedNodeIds,
    setLoading
  } = state;

  const { createNodeMutation, createEdgeMutation } = mutations;

  const handleTutorChat = async (message: string, history: any[] = [], onChunk: (content: string) => void) => {
    try {
      const contextNodeIds = selectedNodeIds.size > 0 ? Array.from(selectedNodeIds) : (selectedNode ? [selectedNode.id] : []);
      
      const _existingNodes = nodes.map(n => n.title);

      await api.ai.tutorChatStream(
        {
          message,
          graph_id: id,
          history,
          context_node_ids: contextNodeIds,
          mode: tutorMode
        },
        onChunk
      );
    } catch (error: any) {
      console.error('Tutor chat error:', error);
      addMessage({ type: 'error', content: '助教对话失败，请重试' });
      throw error;
    }
  };

  const handleExtractConcepts = async (text: string) => {
    setLoading(true);
    try {
      const existingNodes = nodes.map(n => n.title);
      
      const result = await api.ai.extractConcepts({
        text,
        existing_nodes: existingNodes,
        max_concepts: 5
      });

      setExtractedConcepts(result.concepts || []);
      
      if (result.concepts && result.concepts.length > 0) {
        addMessage({ 
          type: 'success', 
          content: `提取了 ${result.concepts.length} 个概念，可以添加到图谱中` 
        });
      } else {
        addMessage({ 
          type: 'info', 
          content: '未提取到新的概念' 
        });
      }
    } catch (error: any) {
      console.error('Extract concepts error:', error);
      addMessage({ type: 'error', content: '概念提取失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddConceptToGraph = async (concept: ExtractedConcept) => {
    if (!id) return;
    setLoading(true);
    
    try {
      const parentNode = selectedNode || nodes.find(n => n.level === 'root');
      
      if (!parentNode) {
        addMessage({ type: 'error', content: '请先选择一个父节点' });
        return;
      }

      const parentLevel = parentNode.level || 'root';
      const newLevel = getNextLevel(parentLevel);

      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 4;
      const x = Math.round(parentNode.x_position + Math.cos(angle) * radius);
      const y = Math.round(parentNode.y_position + Math.sin(angle) * radius);
      
      const newNode = await createNodeMutation.mutateAsync({
        graph_id: id,
        title: concept.title,
        content: concept.description,
        x_position: x,
        y_position: y,
        color: getLevelColorHex(newLevel),
        level: newLevel,
        properties: {
          isNew: true,
          source: 'tutor-extraction'
        }
      });
      
      record({ type: 'CREATE_NODE', payload: newNode });

      const newEdge = await createEdgeMutation.mutateAsync({
        source_knowledge_point_id: parentNode.id,
        target_knowledge_point_id: newNode.id,
        relationship_type: 'related',
        graphId: id
      });
      
      record({ type: 'CREATE_EDGE', payload: newEdge });
      
      setExtractedConcepts(prev => prev.filter(c => c.title !== concept.title));
      
      addMessage({ 
        type: 'success', 
        content: `已将 "${concept.title}" 添加到图谱中` 
      });
      
      return newNode;
    } catch (error: any) {
      console.error('Add concept to graph error:', error);
      addMessage({ type: 'error', content: '添加概念失败' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllConcepts = async () => {
    if (extractedConcepts.length === 0) return;
    
    setLoading(true);
    const addedNodes: Node[] = [];
    
    try {
      const parentNode = selectedNode || nodes.find(n => n.level === 'root');
      
      if (!parentNode) {
        addMessage({ type: 'error', content: '请先选择一个父节点' });
        return;
      }

      const parentLevel = parentNode.level || 'root';
      const newLevel = getNextLevel(parentLevel);

      for (const concept of extractedConcepts) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 4;
        const x = Math.round(parentNode.x_position + Math.cos(angle) * radius);
        const y = Math.round(parentNode.y_position + Math.sin(angle) * radius);
        
        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: concept.title,
          content: concept.description,
          x_position: x,
          y_position: y,
          color: getLevelColorHex(newLevel),
          level: newLevel,
          properties: {
            isNew: true,
            source: 'tutor-extraction'
          }
        });
        
        record({ type: 'CREATE_NODE', payload: newNode });

        const newEdge = await createEdgeMutation.mutateAsync({
          source_knowledge_point_id: parentNode.id,
          target_knowledge_point_id: newNode.id,
          relationship_type: 'related',
          graphId: id
        });
        
        record({ type: 'CREATE_EDGE', payload: newEdge });
        
        addedNodes.push(newNode);
      }
      
      setExtractedConcepts([]);
      
      addMessage({ 
        type: 'success', 
        content: `已将 ${addedNodes.length} 个概念添加到图谱中` 
      });
    } catch (error: any) {
      console.error('Add all concepts error:', error);
      addMessage({ type: 'error', content: '批量添加概念失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestNextTopics = async () => {
    if (!selectedNode) return;
    setLoading(true);
    
    try {
      const existingNodes = nodes.map(n => n.title);
      
      const result = await api.ai.suggestNextTopic({
        node_title: selectedNode.title,
        node_content: selectedNode.content,
        existing_nodes: existingNodes,
        user_progress: {
          mastered_count: nodes.filter(n => n.level === 'root').length,
          due_count: 0,
          current_level: 'intermediate'
        }
      });

      setSuggestedNextTopics(result.suggestions || []);
      
      if (result.suggestions && result.suggestions.length > 0) {
        addMessage({ 
          type: 'success', 
          content: `生成了 ${result.suggestions.length} 个学习建议` 
        });
      } else {
        addMessage({ 
          type: 'info', 
          content: '暂无学习建议' 
        });
      }
    } catch (error: any) {
      console.error('Suggest next topics error:', error);
      addMessage({ type: 'error', content: '生成学习建议失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchTutorMode = (mode: TutorMode) => {
    setTutorMode(mode);
    setIsTutorMode(true);
    addMessage({ 
      type: 'info', 
      content: `已切换到${mode === 'free' ? '自由对话' : '引导学习'}模式` 
    });
  };

  const handleToggleTutorMode = () => {
    const _newMode = isTutorMode ? 'none' : 'free';
    setIsTutorMode(!isTutorMode);
    if (!isTutorMode) {
      setTutorMode('free');
      addMessage({ 
        type: 'info', 
        content: '助教模式已开启' 
      });
    } else {
      addMessage({ 
        type: 'info', 
        content: '助教模式已关闭' 
      });
    }
  };

  return {
    handleTutorChat,
    handleExtractConcepts,
    handleAddConceptToGraph,
    handleAddAllConcepts,
    handleSuggestNextTopics,
    handleSwitchTutorMode,
    handleToggleTutorMode
  };
};
