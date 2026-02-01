import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Undo, Redo, List, Search, Sparkles, MessageSquare, 
  Plus, Eraser, Trash2, Navigation, Grid, Settings, Sun, Moon, 
  Maximize, Minimize, Download, MoreHorizontal, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Node } from '../../types';

interface GraphToolbarProps {
  // Navigation & History
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // View
  title: string;
  sidebarMode: 'none' | 'create' | 'edit' | 'outline' | 'detail';
  setSidebarMode: (mode: 'none' | 'create' | 'edit' | 'outline' | 'detail') => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  layoutMode: '3d-force' | '2d-tree' | '3d-sphere';
  setLayoutMode: (mode: '3d-force' | '2d-tree' | '3d-sphere') => void;
  isFocusMode: boolean;
  setIsFocusMode: (mode: boolean) => void;

  // Tools
  aiEnabled?: boolean;
  onTextToGraph: () => void;
  onAIExpand?: () => void; // New prop for AI Expand
  onBackgroundTask?: (type: 'generate_questions' | 'expand_graph') => void; // New prop
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isPathfindingMode: boolean;
  setIsPathfindingMode: (mode: boolean) => void;
  pathfindingState: {
    startNode: Node | null;
    endNode: Node | null;
    pathLength: number;
    reset: () => void;
  };

  // Edit
  onAddNode: () => void;
  isDeleteMode: boolean;
  setIsDeleteMode: (mode: boolean) => void;
  selectedNodeIds: Set<string>;
  onDeleteSelected: () => void;
  onBatchDelete: () => void;
  onBatchColorUpdate?: (color: string) => void;
  onBatchLevelUpdate?: (level: string) => void;

  // Settings & Export
  onOpenSettings: () => void;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: (open: boolean) => void;
  exportActions: {
    onMarkdown: () => void;
    onPDF: () => void;
    onJSON: () => void;
    onImage: () => void;
    onDeleteGraph: () => void;
  };
  onRefresh?: () => void;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({
  onBack, onUndo, onRedo, canUndo, canRedo,
  title, sidebarMode, setSidebarMode,
  showGrid, setShowGrid, layoutMode, setLayoutMode, isFocusMode, setIsFocusMode,
  aiEnabled, onTextToGraph, onAIExpand, onBackgroundTask, isChatOpen, setIsChatOpen, isPathfindingMode, setIsPathfindingMode, pathfindingState,
  onAddNode, isDeleteMode, setIsDeleteMode, selectedNodeIds, onDeleteSelected, onBatchDelete,
  onBatchColorUpdate, onBatchLevelUpdate,
  onOpenSettings, isExportMenuOpen, setIsExportMenuOpen, exportActions, onRefresh
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isExpanded, setIsExpanded] = useState(false); // For mobile menu

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const themeClasses = {
    container: isDark ? 'bg-slate-800/90 border-slate-700 text-gray-100' : 'bg-white/90 border-gray-200 text-gray-800',
    button: {
      default: isDark ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100',
      active: isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600',
      disabled: isDark ? 'text-slate-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
    },
    divider: isDark ? 'bg-slate-600' : 'bg-gray-300',
    input: isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-800',
    dropdown: isDark ? 'bg-slate-800 border-slate-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
    itemHover: isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
  };

  const Divider = () => <div className={`w-px h-6 mx-1 flex-shrink-0 ${themeClasses.divider}`} />;

  const Button = ({ onClick, active, disabled, title, icon: Icon, colorClass, activeClass }: any) => {
    // Determine classes based on state and theme
    let className = `p-1.5 rounded transition-colors flex-shrink-0 `;
    
    if (disabled) {
      className += themeClasses.button.disabled;
    } else if (active) {
      className += activeClass || themeClasses.button.active;
    } else {
      className += `${themeClasses.button.default} ${colorClass || ''}`;
    }

    return (
      <button 
        onClick={onClick}
        disabled={disabled}
        className={className}
        title={title}
      >
        <Icon size={20} />
      </button>
    );
  };

  // Group: Navigation & History
  const NavGroup = () => (
    <div className="flex items-center space-x-1">
      <Button onClick={onBack} icon={ArrowLeft} title="返回" />
      <Divider />
      <h2 className={`font-bold px-2 py-1 max-w-[150px] truncate hidden md:block ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{title}</h2>
      <Divider />
      <Button onClick={onUndo} disabled={!canUndo} icon={Undo} title="撤销 (Ctrl+Z)" />
      <Button onClick={onRedo} disabled={!canRedo} icon={Redo} title="重做 (Ctrl+Shift+Z)" />
    </div>
  );

  // Group: AI & Advanced Tools
  const AIGroup = () => (
    <div className="flex items-center space-x-1">
      <Button 
        onClick={onTextToGraph} 
        icon={Sparkles} 
        colorClass="text-purple-600" 
        title="AI 文本/文档生成图谱" 
      />
      <Button 
        onClick={() => setIsChatOpen(!isChatOpen)} 
        active={isChatOpen} 
        icon={MessageSquare} 
        colorClass="text-purple-600" 
        title="图谱助手" 
      />
      <Button 
        onClick={() => {
            setIsPathfindingMode(!isPathfindingMode);
            pathfindingState.reset();
        }}
        active={isPathfindingMode}
        icon={Navigation}
        title={isPathfindingMode ? "退出路径导航" : "路径导航"}
      />
      {aiEnabled === false && (
        <span className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${
          isDark ? 'bg-amber-900/30 text-amber-300 border border-amber-800/60' : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          AI 未配置
        </span>
      )}
    </div>
  );

  // Group: Edit Tools
  const EditGroup = () => {
    return (
      <div className="flex items-center space-x-1">
        <Button 
          onClick={onAddNode} 
          icon={Plus} 
          colorClass="text-blue-600" 
          title="添加节点" 
        />
        <Button 
          onClick={() => setIsDeleteMode(!isDeleteMode)} 
          active={isDeleteMode} 
          activeClass="bg-red-50 text-red-600 ring-2 ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-800"
          icon={Eraser} 
          title={isDeleteMode ? "退出删除模式" : "删除模式"} 
        />
        
        {selectedNodeIds.size > 0 && (
          <Button 
            onClick={selectedNodeIds.size > 1 ? onBatchDelete : onDeleteSelected}
            icon={Trash2}
            colorClass="text-red-600"
            title={selectedNodeIds.size > 1 ? "批量删除" : "删除选中节点"}
          />
        )}
      </div>
    );
  };

  const BatchMenu = () => {
    const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);
    
    if (selectedNodeIds.size <= 1) return null;

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={() => setIsBatchMenuOpen(!isBatchMenuOpen)}
          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm ${
            isBatchMenuOpen
              ? 'bg-indigo-600 text-white'
              : (isDark ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 hover:bg-indigo-800/60' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100')
          }`}
          title="批量操作"
        >
          <MoreHorizontal size={18} />
          <span className="text-xs font-bold">批量 ({selectedNodeIds.size})</span>
          <ChevronDown size={14} className={`transition-transform ${isBatchMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {isBatchMenuOpen && (
          <div className={`absolute top-full left-0 mt-2 shadow-2xl rounded-xl border w-60 py-2 z-50 ${themeClasses.dropdown} animate-in fade-in zoom-in-95 duration-150`}>
            <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
              <span>批量操作</span>
              <span className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{selectedNodeIds.size} 节点</span>
            </div>
            <div className="border-t my-1 border-gray-100 dark:border-slate-700"></div>
            
            {/* Batch Color */}
            <div className="px-4 py-3">
              <div className="text-[10px] text-gray-500 mb-2.5 font-bold flex items-center gap-1.5">
                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                修改颜色
              </div>
              <div className="flex flex-wrap gap-2.5">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'].map(color => (
                  <button 
                    key={color}
                    onClick={() => {
                      onBatchColorUpdate?.(color);
                      setIsBatchMenuOpen(false);
                    }}
                    className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white dark:hover:border-slate-400 hover:scale-125 transition-all shadow-sm ring-1 ring-gray-200 dark:ring-slate-700"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div className="border-t my-1 border-gray-100 dark:border-slate-700"></div>

            {/* Batch Level */}
            <div className="px-4 py-3">
              <div className="text-[10px] text-gray-500 mb-2.5 font-bold flex items-center gap-1.5">
                <div className="w-1 h-3 bg-green-500 rounded-full"></div>
                修改等级
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'root', label: '根节点' },
                  { id: 'core', label: '核心' },
                  { id: 'sub', label: '次级' },
                  { id: 'normal', label: '普通' },
                  { id: 'leaf', label: '叶子' }
                ].map(level => (
                  <button 
                    key={level.id}
                    onClick={() => {
                      onBatchLevelUpdate?.(level.id);
                      setIsBatchMenuOpen(false);
                    }}
                    className={`px-2 py-1.5 text-[10px] rounded-lg border font-medium transition-all ${themeClasses.itemHover} ${isDark ? 'border-slate-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t my-1 border-gray-100 dark:border-slate-700"></div>
            <div className="px-2 pt-1">
              <button 
                onClick={() => {
                  onBatchDelete();
                  setIsBatchMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 transition-colors font-semibold"
              >
                <Trash2 size={16} />
                <span>批量删除选中</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Group: Layout & Export
  const SystemGroup = () => (
    <div className="flex items-center space-x-1">
      <Button onClick={onOpenSettings} icon={Settings} title="图谱设置" />
      
      {/* Layout Switcher */}
      <div className={`flex rounded-lg p-1 mx-1 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
        {[
          { id: '3d-force', label: '3D' }, 
          { id: '2d-tree', label: '树' }, 
          { id: '3d-sphere', label: '球' }
        ].map(mode => (
          <button 
            key={mode.id}
            onClick={() => setLayoutMode(mode.id as any)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
              layoutMode === mode.id 
                ? (isDark ? 'bg-slate-600 shadow text-blue-400' : 'bg-white shadow text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Button 
          onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
          active={isExportMenuOpen} 
          icon={Download} 
          title="导出" 
        />
        {isExportMenuOpen && (
          <div className={`absolute top-full right-0 mt-2 shadow-xl rounded-lg border w-48 py-1 z-50 ${themeClasses.dropdown}`}>
             {/* Reuse existing export menu items */}
             <div className="py-1">
               <button onClick={exportActions.onMarkdown} className={`block w-full text-left px-4 py-2 text-sm ${themeClasses.itemHover} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>导出 Markdown</button>
               <button onClick={exportActions.onPDF} className={`block w-full text-left px-4 py-2 text-sm ${themeClasses.itemHover} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>导出 PDF</button>
               <button onClick={exportActions.onJSON} className={`block w-full text-left px-4 py-2 text-sm ${themeClasses.itemHover} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>导出 JSON (备份)</button>
               <button onClick={exportActions.onImage} className={`block w-full text-left px-4 py-2 text-sm ${themeClasses.itemHover} ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>导出为图片</button>
               <div className={`border-t my-1 ${themeClasses.divider}`}></div>
               <button onClick={exportActions.onDeleteGraph} className={`block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30`}>删除此图谱</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render logic based on responsive state
  if (isFocusMode) {
    return (
      <div className="absolute top-4 left-4 z-50">
        <button 
          onClick={() => setIsFocusMode(false)}
          className={`p-2 rounded-full backdrop-blur-sm transition-all shadow-sm ${
            isDark 
              ? 'bg-slate-800/20 hover:bg-slate-800/90 text-white hover:text-blue-400' 
              : 'bg-white/20 hover:bg-white/90 text-white hover:text-gray-800'
          }`}
          title="退出专注模式 (Esc)"
        >
          <Minimize size={20} />
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2">
        <div className={`p-2 rounded-lg shadow-md flex items-center space-x-2 backdrop-blur-sm ${themeClasses.container}`}>
           <Button onClick={onBack} icon={ArrowLeft} title="返回" />
           <Divider />
           <Button onClick={toggleTheme} icon={isDark ? Sun : Moon} title="切换主题" />
           {selectedNodeIds.size > 1 && (
             <>
               <Divider />
               <BatchMenu />
             </>
           )}
           <Button 
             onClick={() => setIsExpanded(!isExpanded)} 
             icon={isExpanded ? ChevronUp : ChevronDown} 
             title="更多工具" 
           />
        </div>
        
        {isExpanded && (
          <div className={`p-2 rounded-lg shadow-md flex flex-col gap-2 animate-in slide-in-from-top-2 backdrop-blur-sm ${themeClasses.container}`}>
             <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                <Button onClick={onUndo} disabled={!canUndo} icon={Undo} />
                <Button onClick={onRedo} disabled={!canRedo} icon={Redo} />
                <Divider />
                <Button onClick={onAddNode} icon={Plus} colorClass="text-blue-600" />
                <Button onClick={() => setIsDeleteMode(!isDeleteMode)} active={isDeleteMode} icon={Eraser} />
             </div>
             <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                <Button onClick={() => setSidebarMode(sidebarMode === 'outline' ? 'none' : 'outline')} active={sidebarMode === 'outline'} icon={List} />
                <Button onClick={() => setIsChatOpen(!isChatOpen)} active={isChatOpen} icon={MessageSquare} />
             </div>
             <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
                <Button onClick={onOpenSettings} icon={Settings} />
                <Button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} active={isExportMenuOpen} icon={Download} />
             </div>
          </div>
        )}
      </div>
    );
  }

  const [openDropdown, setOpenDropdown] = useState<'edit' | 'ai' | 'system' | 'view' | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const DropdownButton = ({ id, icon: Icon, label, children, active }: any) => (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpenDropdown(openDropdown === id ? null : id)}
        className={`flex items-center space-x-1 px-2 py-1.5 rounded transition-all ${
          active || openDropdown === id
            ? (isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600')
            : (isDark ? 'text-gray-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100')
        }`}
      >
        <Icon size={20} />
        {!isMobile && <span className="text-sm font-medium">{label}</span>}
        <ChevronDown size={14} className={`transition-transform duration-200 ${openDropdown === id ? 'rotate-180' : ''}`} />
      </button>
      
      {openDropdown === id && (
        <div className={`absolute top-full left-0 mt-2 p-2 rounded-xl shadow-2xl border w-56 z-50 flex flex-col gap-1 ${themeClasses.dropdown} animate-in fade-in zoom-in-95 duration-150`}>
          {children}
        </div>
      )}
    </div>
  );

  const MenuItem = ({ onClick, icon: Icon, label, active, colorClass, activeClass, disabled }: any) => (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        setOpenDropdown(null);
      }}
      className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${
        disabled ? themeClasses.button.disabled :
        active 
          ? (activeClass || (isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'))
          : `${themeClasses.itemHover} ${colorClass || (isDark ? 'text-gray-300' : 'text-gray-700')}`
      }`}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span className="flex-grow text-left font-medium">{label}</span>
    </button>
  );

  // Desktop Layout - Priority Sorted with Dropdowns
  return (
    <div className={`absolute top-4 left-4 p-2 rounded-xl shadow-lg flex items-center space-x-2 z-10 backdrop-blur-md border ${themeClasses.container}`}>
      {/* 1. Navigation & Basic Info (Always visible) */}
      <div className="flex items-center">
        <button onClick={onBack} className={`p-2 rounded-lg transition-colors ${themeClasses.button.default}`} title="返回">
          <ArrowLeft size={20} />
        </button>
        <Divider />
        <div className="flex items-center space-x-1 px-1">
          <button onClick={onUndo} disabled={!canUndo} className={`p-1.5 rounded-lg ${!canUndo ? themeClasses.button.disabled : themeClasses.button.default}`} title="撤销">
            <Undo size={18} />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className={`p-1.5 rounded-lg ${!canRedo ? themeClasses.button.disabled : themeClasses.button.default}`} title="重做">
            <Redo size={18} />
          </button>
        </div>
      </div>

      <Divider />

      {/* 2. Edit Tools Dropdown */}
      <div className="flex items-center space-x-2">
        <DropdownButton id="edit" icon={Plus} label="编辑" active={isDeleteMode || selectedNodeIds.size > 0}>
          <MenuItem onClick={onAddNode} icon={Plus} label="添加节点" colorClass="text-blue-500" />
          <MenuItem 
            onClick={() => setIsDeleteMode(!isDeleteMode)} 
            icon={Eraser} 
            label={isDeleteMode ? "退出删除模式" : "删除模式"} 
            active={isDeleteMode}
            activeClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
          <MenuItem 
            onClick={onDeleteSelected}
            disabled={selectedNodeIds.size !== 1}
            icon={Trash2}
            label="删除选中节点"
            colorClass="text-red-500"
          />
        </DropdownButton>

        {/* AI Expand Shortcut - Visible when 1 node selected */}
        {selectedNodeIds.size === 1 && onAIExpand && (
          <button
             onClick={onAIExpand}
             className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all shadow-sm animate-in fade-in zoom-in-95 ${
               isDark 
                 ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50 hover:bg-purple-800/60' 
                 : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
             }`}
             title="基于选中节点进行智能拓展 (无限模式)"
          >
            <Sparkles size={16} />
            <span className="text-xs font-bold">无限拓展</span>
          </button>
        )}

        {selectedNodeIds.size > 1 && (
          <>
            <div className={`w-px h-6 mx-1 ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
            <BatchMenu />
          </>
        )}
      </div>

      <Divider />

      {/* 3. AI Tools Dropdown */}
      <DropdownButton id="ai" icon={Sparkles} label="AI 助手" active={isChatOpen || isPathfindingMode}>
        <MenuItem onClick={onTextToGraph} icon={Sparkles} label="文本/文档生成" colorClass="text-purple-500" />
        <MenuItem 
          onClick={() => {
            if (selectedNodeIds.size === 1 && onAIExpand) {
              onAIExpand();
            }
          }}
          disabled={selectedNodeIds.size !== 1}
          icon={Navigation} 
          label="智能拓展 (无限模式)" 
          colorClass="text-green-500"
        />
        <MenuItem 
          onClick={() => {
             if (selectedNodeIds.size === 1 && onBackgroundTask) {
               onBackgroundTask('expand_graph');
             }
          }}
          disabled={selectedNodeIds.size !== 1 || !onBackgroundTask}
          icon={Sparkles} 
          label="后台自动拓展" 
          colorClass="text-blue-500"
        />
        <MenuItem onClick={() => setIsChatOpen(!isChatOpen)} icon={MessageSquare} label="图谱助手" active={isChatOpen} colorClass="text-purple-500" />
        <MenuItem 
          onClick={() => { setIsPathfindingMode(!isPathfindingMode); pathfindingState.reset(); }} 
          icon={Navigation} 
          label={isPathfindingMode ? "退出路径导航" : "路径导航"} 
          active={isPathfindingMode}
        />
      </DropdownButton>

      <Divider />

      {/* 4. View Tools Dropdown */}
      <DropdownButton id="view" icon={List} label="视图">
        <MenuItem onClick={() => setSidebarMode(sidebarMode === 'outline' ? 'none' : 'outline')} icon={List} label="大纲视图" active={sidebarMode === 'outline'} />
        <MenuItem onClick={() => setSidebarMode('outline')} icon={Search} label="搜索节点" />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <div className="px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">布局切换</div>
          <div className={`flex rounded-lg p-1 ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
            {[{ id: '3d-force', label: '3D' }, { id: '2d-tree', label: '树' }, { id: '3d-sphere', label: '球' }].map(mode => (
              <button 
                key={mode.id}
                onClick={() => setLayoutMode(mode.id as any)}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  layoutMode === mode.id 
                    ? (isDark ? 'bg-slate-600 shadow text-blue-400' : 'bg-white shadow text-blue-600')
                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </DropdownButton>

      <Divider />

      {/* 5. System & Settings Dropdown */}
      <DropdownButton id="system" icon={Settings} label="设置">
        <MenuItem onClick={onRefresh} icon={RefreshCw} label="刷新数据" disabled={!onRefresh} />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem onClick={() => setShowGrid(!showGrid)} icon={Grid} label={showGrid ? "隐藏网格" : "显示网格"} active={showGrid} />
        <MenuItem onClick={toggleTheme} icon={isDark ? Sun : Moon} label={isDark ? "浅色模式" : "深色模式"} />
        <MenuItem onClick={() => setIsFocusMode(true)} icon={Maximize} label="专注模式 (F)" />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem onClick={onOpenSettings} icon={Settings} label="图谱参数设置" />
        <MenuItem onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} icon={Download} label="导出图谱" active={isExportMenuOpen} />
        <div className={`h-px w-full my-1 ${themeClasses.divider}`}></div>
        <MenuItem onClick={exportActions.onDeleteGraph} icon={Trash2} label="彻底删除此图谱" colorClass="text-red-500" />
      </DropdownButton>
    </div>
  );
};
