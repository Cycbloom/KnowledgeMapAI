import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, Network, GitBranch, Clock, 
  Sun, Moon, Layout, Focus, LayoutList, Plus, Trash2 
} from 'lucide-react';
import type { CommandItem } from '../../components/GraphEditor/CommandPalette';
import type { Node, GraphViewMode } from '../../types';
import type { MessageType } from '../../store/useMessageStore';
import type { SidebarMode } from '../../hooks/graphEditor/useSidebarState';

interface UseCommandPaletteOptions {
  sidebarMode: SidebarMode;
  isDark: boolean;
  isFocusMode: boolean;
  selectedNode: Node | null;
  toggleTheme: () => void;
  setSidebarMode: Dispatch<SetStateAction<SidebarMode>>;
  setViewMode: Dispatch<SetStateAction<GraphViewMode>>;
  setIsFocusMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  handleDeleteNode: (node: Node | null) => void;
  addMessage: (msg: { type: MessageType; content: string }) => string;
}

export const useCommandPalette = (options: UseCommandPaletteOptions): CommandItem[] => {
  const {
    sidebarMode,
    isDark,
    isFocusMode,
    selectedNode,
    toggleTheme,
    setSidebarMode,
    setViewMode,
    setIsFocusMode,
    handleDeleteNode,
    addMessage
  } = options;

  const navigate = useNavigate();

  return useMemo(() => [
    {
      id: 'nav-home',
      label: '返回首页',
      icon: <Home size={18} />,
      category: 'navigation',
      action: () => navigate('/'),
      keywords: ['home', 'index', 'back']
    },
    {
      id: 'nav-graphs',
      label: '图谱列表',
      icon: <LayoutList size={18} />,
      category: 'navigation',
      action: () => navigate('/graphs'),
      keywords: ['list', 'graphs', 'all']
    },
    {
      id: 'view-mindmap',
      label: '思维导图视图',
      icon: <Network size={18} />,
      category: 'view',
      action: () => setViewMode('mindmap'),
      keywords: ['mindmap', 'graph', 'canvas']
    },
    {
      id: 'view-timeline',
      label: '时间轴视图',
      icon: <Clock size={18} />,
      category: 'view',
      action: () => setViewMode('timeline'),
      keywords: ['timeline', 'chronology', 'history']
    },
    {
      id: 'view-tree',
      label: '树形视图',
      icon: <GitBranch size={18} />,
      category: 'view',
      action: () => setViewMode('tree'),
      keywords: ['tree', 'structure']
    },
    {
      id: 'toggle-sidebar',
      label: sidebarMode === 'none' ? '打开侧边栏' : '关闭侧边栏',
      icon: <Layout size={18} />,
      category: 'view',
      shortcut: 'Space',
      action: () => {
        if (sidebarMode === 'none') setSidebarMode('outline');
        else setSidebarMode('none');
      },
      keywords: ['sidebar', 'panel', 'drawer']
    },
    {
      id: 'toggle-theme',
      label: isDark ? '切换亮色模式' : '切换暗色模式',
      icon: isDark ? <Sun size={18} /> : <Moon size={18} />,
      category: 'view',
      action: toggleTheme,
      keywords: ['theme', 'dark', 'light', 'mode']
    },
    {
      id: 'toggle-focus',
      label: isFocusMode ? '退出专注模式' : '进入专注模式',
      icon: <Focus size={18} />,
      category: 'view',
      action: () => setIsFocusMode(prev => !prev),
      keywords: ['focus', 'zen', 'mode']
    },
    {
      id: 'create-node',
      label: '新建子节点',
      icon: <Plus size={18} />,
      category: 'action',
      shortcut: 'Tab',
      action: () => {
        if (selectedNode) {
          addMessage({ type: 'info', content: '请使用 Tab 键创建子节点' });
        } else {
          addMessage({ type: 'warning', content: '请先选择一个节点' });
        }
      }
    },
    {
      id: 'delete-node',
      label: '删除节点',
      icon: <Trash2 size={18} />,
      category: 'action',
      shortcut: 'Del',
      action: () => {
        if (selectedNode) {
          handleDeleteNode(selectedNode);
        } else {
          addMessage({ type: 'warning', content: '请先选择一个节点' });
        }
      }
    }
  ], [
    navigate, 
    setViewMode, 
    sidebarMode, 
    setSidebarMode, 
    isDark, 
    toggleTheme, 
    isFocusMode, 
    setIsFocusMode, 
    selectedNode, 
    handleDeleteNode, 
    addMessage
  ]);
};
