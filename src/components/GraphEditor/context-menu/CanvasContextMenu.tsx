import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardPaste, CheckSquare, Maximize } from 'lucide-react';

interface CanvasContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onCreateNode: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onFitView: () => void;
  canPaste: boolean;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  position,
  onClose,
  onCreateNode,
  onPaste,
  onSelectAll,
  onFitView,
  canPaste,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      if (rect.width + position.x > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }

      if (rect.height + position.y > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      adjustedX = Math.max(8, adjustedX);
      adjustedY = Math.max(8, adjustedY);

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [position]);

  const menuItems = [
    {
      icon: <Plus size={16} className="text-gray-500 dark:text-gray-400" />,
      label: t('graphEditor.canvasContextMenu.createNode'),
      onClick: onCreateNode,
      disabled: false,
    },
    {
      icon: <ClipboardPaste size={16} className="text-gray-500 dark:text-gray-400" />,
      label: t('graphEditor.canvasContextMenu.paste'),
      onClick: onPaste,
      disabled: !canPaste,
    },
    {
      icon: <CheckSquare size={16} className="text-gray-500 dark:text-gray-400" />,
      label: t('graphEditor.canvasContextMenu.selectAll'),
      onClick: onSelectAll,
      disabled: false,
    },
    {
      icon: <Maximize size={16} className="text-gray-500 dark:text-gray-400" />,
      label: t('graphEditor.canvasContextMenu.fitView'),
      onClick: onFitView,
      disabled: false,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 py-1 z-50 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${
            item.disabled
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
};
