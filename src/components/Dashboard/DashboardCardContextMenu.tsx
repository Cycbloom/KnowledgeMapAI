import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Star, Trash2 } from "lucide-react";
import type { Graph } from "@shared/types";
import { copyToClipboard } from "@/utils/clipboard";

interface DashboardCardContextMenuProps {
  graph: Graph;
  position: { x: number; y: number };
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export const DashboardCardContextMenu: React.FC<DashboardCardContextMenuProps> = ({
  graph,
  position,
  onClose,
  onToggleFavorite,
  onDelete,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
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

  const handleCopyId = async () => {
    await copyToClipboard(graph.id, t("dashboard.contextMenu.copiedId"));
    onClose();
  };

  const handleOpenInNewWindow = () => {
    window.open(`/graph/${graph.id}`, "_blank");
    onClose();
  };

  const handleToggleFavorite = () => {
    onToggleFavorite(graph.id);
    onClose();
  };

  const handleDelete = () => {
    onDelete(graph.id);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-500 py-1 z-50 min-w-[180px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-500 mb-1 truncate max-w-[220px]">
        {graph.title}
      </div>
      <button
        onClick={handleCopyId}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
      >
        <Copy size={16} className="text-gray-500 dark:text-gray-400" />
        {t("dashboard.contextMenu.copyId")}
      </button>
      <button
        onClick={handleOpenInNewWindow}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
      >
        <ExternalLink size={16} className="text-gray-500 dark:text-gray-400" />
        {t("dashboard.contextMenu.openInNewWindow")}
      </button>
      <button
        onClick={handleToggleFavorite}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
      >
        <Star
          size={16}
          className={
            graph.is_favorite
              ? "text-yellow-500"
              : "text-gray-500 dark:text-gray-400"
          }
          fill={graph.is_favorite ? "currentColor" : "none"}
        />
        {t("dashboard.contextMenu.toggleFavorite")}
      </button>
      <hr className="my-1 border-gray-200 dark:border-slate-500" />
      <button
        onClick={handleDelete}
        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
      >
        <Trash2 size={16} />
        {t("dashboard.contextMenu.moveToTrash")}
      </button>
    </div>
  );
};
