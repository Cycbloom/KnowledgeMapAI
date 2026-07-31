import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  ExternalLink,
  FileText,
  Code,
  Trash2,
  Link as LinkIcon,
  Link2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { TaskLink } from "../../../types";
import { message as messageHelper } from "../../../utils/messageHelper";
import { asyncConfirm } from "../../../utils/asyncConfirm";
import { EmptyState } from "../../common/EmptyState";

interface TaskLinksProps {
  taskId: string;
  className?: string;
}

const getLinkTypeIcon = (type: string) => {
  switch (type) {
    case "web":
      return ExternalLink;
    case "file":
      return FileText;
    case "api":
      return Code;
    default:
      return LinkIcon;
  }
};

export const TaskLinks: React.FC<TaskLinksProps> = ({
  taskId,
  className = "",
}) => {
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();
  const [newLink, setNewLink] = useState({
    link_type: "web" as "web" | "file" | "api",
    title: "",
    url: "",
    description: "",
  });

  const getLinkTypeLabel = useMemo(() => {
    return (type: string): string => {
      switch (type) {
        case "web":
          return t('scheduler.taskLinks.typeWeb');
        case "file":
          return t('scheduler.taskLinks.typeFile');
        case "api":
          return "API";
        default:
          return t('scheduler.taskLinks.typeLink');
      }
    };
  }, [t]);

  useEffect(() => {
    loadLinks();
  }, [taskId]);

  const loadLinks = async () => {
    try {
      const data = await api.scheduler.getLinks(taskId);
      setLinks(data ?? []);
    } catch (error) {
      console.error("Failed to load links:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!newLink.url.trim()) {
      messageHelper.error(t('scheduler.taskWorkbench.linkUrlRequired'));
      return;
    }

    try {
      const created = await api.scheduler.createLink(taskId, {
        link_type: newLink.link_type,
        title: newLink.title || undefined,
        url: newLink.url,
        description: newLink.description || undefined,
      });
      setLinks([...links, created]);
      setNewLink({ link_type: "web", title: "", url: "", description: "" });
      setIsAdding(false);
      messageHelper.success(t('scheduler.taskWorkbench.linkAdded'));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.linkAddFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!await asyncConfirm({ title: t('common.confirm.deleteLinkTitle'), message: t('common.confirm.deleteLinkMessage'), isDangerous: true })) return;
    try {
      await api.scheduler.deleteLink(taskId, linkId);
      setLinks(links.filter((l) => l.id !== linkId));
      messageHelper.success(t('scheduler.taskWorkbench.linkDeleted'));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskWorkbench.linkDeleteFailed');
      messageHelper.error(errMsg);
    }
  };

  const handleOpenLink = (link: TaskLink) => {
    if (link.link_type === "web") {
      window.open(link.url, "_blank", "noopener,noreferrer");
    } else if (link.link_type === "file") {
      window.open(link.url, "_blank");
    } else {
      window.open(link.url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="flex items-center justify-between cursor-pointer mb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('scheduler.taskLinks.quickLinks')}
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('scheduler.taskLinks.linkCount', { count: links.length })}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          {t('scheduler.taskLinks.add')}
        </button>
      </div>

      {isExpanded && (
        <>
          {isAdding && (
            <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-500">
              <div className="flex gap-2 mb-3">
                {(["web", "file", "api"] as const).map((type) => {
                  const Icon = getLinkTypeIcon(type);
                  return (
                    <button
                      key={type}
                      onClick={() =>
                        setNewLink({ ...newLink, link_type: type })
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        newLink.link_type === type
                          ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Icon size={14} />
                      {getLinkTypeLabel(type)}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={newLink.url}
                onChange={(e) =>
                  setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder={
                  newLink.link_type === "web"
                    ? "https://example.com"
                    : newLink.link_type === "file"
                      ? "file:///path/to/file"
                      : "https://api.example.com"
                }
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
              <input
                type="text"
                value={newLink.title}
                onChange={(e) =>
                  setNewLink({ ...newLink, title: e.target.value })
                }
                placeholder={t('scheduler.taskWorkbench.taskLinks.titlePlaceholder')}
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                value={newLink.description}
                onChange={(e) =>
                  setNewLink({ ...newLink, description: e.target.value })
                }
                placeholder={t('scheduler.taskWorkbench.taskLinks.descriptionPlaceholder')}
                className="w-full px-3 py-2 mb-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewLink({
                      link_type: "web",
                      title: "",
                      url: "",
                      description: "",
                    });
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('scheduler.taskLinks.cancel')}
                </button>
                <button
                  onClick={handleAddLink}
                  className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all"
                >
                  {t('scheduler.taskLinks.add')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {links.map((link) => {
              const Icon = getLinkTypeIcon(link.link_type);
              return (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-500 hover:border-primary-300 dark:hover:border-primary-500/50 transition-all group"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      link.link_type === "web"
                        ? "bg-primary-100 dark:bg-primary-500/20 text-primary-500"
                        : link.link_type === "file"
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                          : "bg-primary-100 dark:bg-primary-500/20 text-primary-500"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {link.title || link.url}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {link.url}
                    </p>
                    {link.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {link.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenLink(link)}
                      className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {links.length === 0 && !isAdding && (
              <EmptyState
                icon={<Link2 size={32} />}
                title={t('scheduler.empty.links')}
                action={{ label: t('scheduler.taskLinks.addFirstLink'), onClick: () => setIsAdding(true) }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};
