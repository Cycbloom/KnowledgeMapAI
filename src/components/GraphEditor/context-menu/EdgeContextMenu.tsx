import React, { useEffect, useRef } from 'react';
import { Edit3, GitBranch, Trash2 } from 'lucide-react';
import type { Edge } from '../../../types';

interface EdgeContextMenuProps {
  edge: Edge;
  position: { x: number; y: number };
  onClose: () => void;
  onEditLabel: () => void;
  onChangeRelationshipType: () => void;
  onDelete: () => void;
}

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  edge: _edge,
  position,
  onClose,
  onEditLabel,
  onChangeRelationshipType,
  onDelete
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 py-1 z-50 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => {
          onEditLabel();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
      >
        <Edit3 size={16} className="text-gray-500 dark:text-gray-400" />
        编辑标签
      </button>
      <button
        onClick={() => {
          onChangeRelationshipType();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
      >
        <GitBranch size={16} className="text-gray-500 dark:text-gray-400" />
        更改关系类型
      </button>
      <hr className="my-1 border-gray-200 dark:border-slate-500" />
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
      >
        <Trash2 size={16} />
        删除边
      </button>
    </div>
  );
};
