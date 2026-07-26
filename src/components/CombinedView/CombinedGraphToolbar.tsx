import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Sun, Moon,
  Download, List, Layers, Activity, FileJson, Image
} from 'lucide-react';
import { useTheme } from "../../hooks";
import type { GraphColorMode, Node } from '../../types';

interface DividerProps {
  className: string;
}

const Divider: React.FC<DividerProps> = ({ className }) => (
  <div className={`w-px h-6 mx-1 flex-shrink-0 ${className}`} />
);

interface ButtonProps { 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean; 
  title: string; 
  icon: React.ElementType;
  colorClass?: string;
  buttonClasses: {
    default: string;
    active: string;
  };
  isDark: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  active, 
  disabled, 
  title, 
  icon: Icon, 
  colorClass,
  buttonClasses,
  isDark
}) => {
  let className = 'p-1.5 rounded transition-colors flex-shrink-0 ';
  
  if (disabled) {
    className += isDark ? 'text-slate-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed';
  } else if (active) {
    className += buttonClasses.active;
  } else {
    className += `${buttonClasses.default} ${colorClass || ''}`;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
      aria-label={title}
    >
      <Icon size={18} />
    </button>
  );
};

interface CombinedGraphToolbarProps {
  graph1Title: string;
  graph2Title: string;
  onBack: () => void;
  coloringMode: GraphColorMode;
  onToggleColoringMode: () => void;
  onExportImage: () => void;
  onExportJSON: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  selectedNode: Node | null;
}

export const CombinedGraphToolbar: React.FC<CombinedGraphToolbarProps> = ({
  graph1Title,
  graph2Title,
  onBack,
  coloringMode,
  onToggleColoringMode,
  onExportImage,
  onExportJSON,
  onToggleSidebar,
  isSidebarOpen,
  selectedNode
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const themeClasses = {
    container: isDark 
      ? 'bg-slate-800/90 border-slate-700 text-gray-100' 
      : 'bg-white/90 border-gray-200 text-gray-800',
    button: {
      default: isDark 
        ? 'text-gray-300 hover:bg-slate-700' 
        : 'text-gray-600 hover:bg-gray-100',
      active: isDark 
        ? 'bg-primary-900/50 text-primary-400' 
        : 'bg-primary-50 text-primary-600',
    },
    divider: isDark ? 'bg-slate-600' : 'bg-gray-300',
    dropdown: isDark 
      ? 'bg-slate-800 border-slate-700 text-gray-100' 
      : 'bg-white border-gray-200 text-gray-800',
    itemHover: isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
  };

  return (
    <div
      role="toolbar"
      aria-label={t("common.aria.toolbar.combinedGraph")}
      className={`absolute top-4 left-4 p-2 rounded-xl shadow-lg flex items-center space-x-2 z-10 backdrop-blur-md border ${themeClasses.container}`}
    >
      <Button onClick={onBack} icon={ArrowLeft} title={t('common.aria.back')} buttonClasses={themeClasses.button} isDark={isDark} />
      <Divider className={themeClasses.divider} />
      
      <div className="flex items-center gap-2 px-2">
        <div className="w-2 h-2 rounded-full bg-primary-500" />
        <span className="text-sm font-medium max-w-[100px] truncate">{graph1Title}</span>
        <span className="text-gray-400 dark:text-gray-500">+</span>
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm font-medium max-w-[100px] truncate">{graph2Title}</span>
      </div>
      
      <Divider className={themeClasses.divider} />
      
      <div className="flex items-center space-x-1">
        <Button 
          onClick={onToggleColoringMode} 
          icon={coloringMode === 'level' ? Layers : Activity} 
          title={coloringMode === 'level' ? '着色模式: 结构' : '着色模式: 热力图'}
          colorClass={coloringMode === 'level' ? 'text-primary-500' : 'text-orange-500'}
          buttonClasses={themeClasses.button}
          isDark={isDark}
        />
        <Button onClick={toggleTheme} icon={isDark ? Sun : Moon} title={isDark ? '浅色模式' : '深色模式'} buttonClasses={themeClasses.button} isDark={isDark} />
      </div>
      
      <Divider className={themeClasses.divider} />
      
      <Button 
        onClick={onToggleSidebar} 
        active={isSidebarOpen} 
        icon={List} 
        title={isSidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
        buttonClasses={themeClasses.button}
        isDark={isDark}
      />
      
      <Divider className={themeClasses.divider} />
      
      <div className="relative">
        <Button 
          onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} 
          active={isExportMenuOpen}
          icon={Download} 
          title="导出"
          buttonClasses={themeClasses.button}
          isDark={isDark}
        />
        {isExportMenuOpen && (
          <div className={`absolute top-full right-0 mt-2 shadow-xl rounded-lg border w-40 py-1 z-50 ${themeClasses.dropdown}`}>
            <button 
              onClick={() => { onExportImage(); setIsExportMenuOpen(false); }}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm ${themeClasses.itemHover}`}
            >
              <Image size={14} />
              导出图片
            </button>
            <button 
              onClick={() => { onExportJSON(); setIsExportMenuOpen(false); }}
              className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm ${themeClasses.itemHover}`}
            >
              <FileJson size={14} />
              导出 JSON
            </button>
          </div>
        )}
      </div>
      
      {selectedNode && (
        <>
          <Divider className={themeClasses.divider} />
          <div className="flex items-center gap-2 px-2 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <span className="text-xs text-primary-600 dark:text-primary-400">
              已选: {selectedNode.title}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
