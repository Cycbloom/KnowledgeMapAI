import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Home, Network, GitBranch, Clock, 
  Sun, Moon, Layout, Focus, LayoutList, Plus, Trash2 
} from 'lucide-react';
import type { CommandItem } from '../../components/GraphEditor/shared/CommandPalette';
import type { Node, GraphViewMode } from '../../types';
import type { MessageShowPayload } from '../../services/FrontendEventTypes';
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
  addMessage: (msg: { type: MessageShowPayload["type"]; content: string }) => void;
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
  const { t } = useTranslation();

  return useMemo(() => [
    {
      id: 'nav-home',
      label: t('graphEditor.commands.backToHome'),
      icon: <Home size={18} />,
      category: 'navigation',
      action: () => navigate('/'),
      keywords: ['home', 'index', 'back']
    },
    {
      id: 'nav-graphs',
      label: t('graphEditor.commands.graphList'),
      icon: <LayoutList size={18} />,
      category: 'navigation',
      action: () => navigate('/graphs'),
      keywords: ['list', 'graphs', 'all']
    },
    {
      id: 'view-mindmap',
      label: t('graphEditor.commands.mindmapView'),
      icon: <Network size={18} />,
      category: 'view',
      action: () => setViewMode('mindmap'),
      keywords: ['mindmap', 'graph', 'canvas']
    },
    {
      id: 'view-timeline',
      label: t('graphEditor.commands.timelineView'),
      icon: <Clock size={18} />,
      category: 'view',
      action: () => setViewMode('timeline'),
      keywords: ['timeline', 'chronology', 'history']
    },
    {
      id: 'view-tree',
      label: t('graphEditor.commands.treeView'),
      icon: <GitBranch size={18} />,
      category: 'view',
      action: () => setViewMode('tree'),
      keywords: ['tree', 'structure']
    },
    {
      id: 'toggle-sidebar',
      label: sidebarMode === 'none' ? t('graphEditor.commands.openSidebar') : t('graphEditor.commands.closeSidebar'),
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
      label: isDark ? t('graphEditor.commands.switchToLight') : t('graphEditor.commands.switchToDark'),
      icon: isDark ? <Sun size={18} /> : <Moon size={18} />,
      category: 'view',
      action: toggleTheme,
      keywords: ['theme', 'dark', 'light', 'mode']
    },
    {
      id: 'toggle-focus',
      label: isFocusMode ? t('graphEditor.commands.exitFocusMode') : t('graphEditor.commands.enterFocusMode'),
      icon: <Focus size={18} />,
      category: 'view',
      action: () => setIsFocusMode(prev => !prev),
      keywords: ['focus', 'zen', 'mode']
    },
    {
      id: 'create-node',
      label: t('graphEditor.commands.newSubnode'),
      icon: <Plus size={18} />,
      category: 'action',
      shortcut: 'Tab',
      action: () => {
        if (selectedNode) {
          addMessage({ type: 'info', content: t('graphEditor.commandPalette.tabCreateChildHint') });
        } else {
          addMessage({ type: 'warning', content: t('graphEditor.commands.selectNodeFirst') });
        }
      }
    },
    {
      id: 'delete-node',
      label: t('graphEditor.commands.deleteNode'),
      icon: <Trash2 size={18} />,
      category: 'action',
      shortcut: 'Del',
      action: () => {
        if (selectedNode) {
          handleDeleteNode(selectedNode);
        } else {
          addMessage({ type: 'warning', content: t('graphEditor.commands.selectNodeFirst') });
        }
      }
    }
  ], [
    navigate,
    t,
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
