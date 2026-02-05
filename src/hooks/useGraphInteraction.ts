import { Node, Edge } from '../types';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { findShortestPath } from '../lib/graphUtils';

interface UseGraphInteractionProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, any> | undefined;
  state: GraphEditorState;
  handleDeleteNode: (node: Node) => void;
}

export const useGraphInteraction = ({
  nodes,
  edges,
  nodeStatus,
  state,
  handleDeleteNode
}: UseGraphInteractionProps) => {
  const { addMessage } = useMessageStore();
  const { 
    isDeleteMode, 
    isPathfindingMode,
    pathStartNode, setPathStartNode,
    pathEndNode, setPathEndNode,
    setHighlightedPath,
    setSelectedNode,
    setSelectedNodeIds,
    setPrevSidebarMode,
    setSidebarMode,
    sidebarMode,
    setLayoutMode,
    graphRef
  } = state;

  const handleNodeClick = (node: Node) => {
    if (isDeleteMode) {
      handleDeleteNode(node);
      return;
    }

    if (nodeStatus && nodeStatus[node.id]?.locked) {
      addMessage({ content: '此节点尚未解锁！请先学习前置知识点。', type: 'warning' });
      return;
    }

    if (isPathfindingMode) {
      if (!pathStartNode) {
        setPathStartNode(node);
        addMessage({ content: '请选择终点节点', type: 'info' });
      } else if (!pathEndNode) {
        setPathEndNode(node);
        const path = findShortestPath(nodes, edges, pathStartNode.id, node.id);
        if (path.nodes.size > 0) {
          setHighlightedPath(path);
          addMessage({ content: `找到路径，长度: ${path.nodes.size - 1} 步`, type: 'success' });
        } else {
          addMessage({ content: '未找到路径', type: 'error' });
        }
      } else {
        // Reset and start over
        setPathStartNode(node);
        setPathEndNode(null);
        setHighlightedPath(null);
      }
      return;
    }

    setSelectedNode(node);
    setSelectedNodeIds(new Set([node.id]));
    setPrevSidebarMode(sidebarMode);
    setSidebarMode('detail');
  };

  const handleSelectionChange = (ids: string[]) => {
    const newSet = new Set(ids);
    setSelectedNodeIds(newSet);
    
    if (newSet.size === 1) {
      const node = nodes.find(n => n.id === ids[0]);
      if (node) {
        setSelectedNode(node);
        setPrevSidebarMode(sidebarMode);
        setSidebarMode('edit');
      }
    } else if (newSet.size > 1) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
    
    if (newSet.size === 0) {
      setSelectedNode(null);
      setSidebarMode('none');
    }
  };

  const handleLayoutChange = (mode: '3d-force' | '2d-tree' | '3d-sphere' | 'solar' | '2d-map') => {
    setLayoutMode(mode);
    const modeName = mode === '2d-tree' ? '2D 树状图' : 
                    mode === '3d-sphere' ? '3D 球形布局' : 
                    mode === 'solar' ? '星系 radial 布局' : 
                    mode === '2d-map' ? '2D 地图模式' : '3D 力导向';
    addMessage({ type: 'success', content: `切换至 ${modeName}` });
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setSelectedNodeIds(new Set());
    setSidebarMode('none');
  };

  return {
    handleNodeClick,
    handleSelectionChange,
    handleLayoutChange,
    handleBackgroundClick
  };
};
