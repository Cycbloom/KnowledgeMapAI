import React, { useState, useEffect, useMemo, useRef } from "react";
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
  UploadCloud,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { TaskLink } from "../../../types";
import { message as messageHelper } from "../../../utils/messageHelper";
import { asyncConfirm } from "../../../utils/asyncConfirm";
import { EmptyState } from "../../common/EmptyState";
import { isElectron } from "@/config/electronConfig";

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

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFilePath = (file: File): string | undefined => {
  // 优先走 preload 暴露的 webUtils（现代 Electron 官方取真实路径的方式）
  try {
    if (window.electronAPI?.shell?.getPathForFile) {
      const p = window.electronAPI.shell.getPathForFile(file);
      if (typeof p === "string" && p) return p;
    }
  } catch {
    // ignore
  }
  try {
    const w = window as unknown as {
      webUtils?: { getPathForFile: (f: File) => string };
    };
    if (isElectron() && w.webUtils?.getPathForFile) {
      return w.webUtils.getPathForFile(file);
    }
  } catch {
    // ignore
  }
  try {
    const p = (file as unknown as { path?: string }).path;
    if (typeof p === "string" && p) return p;
  } catch {
    // ignore
  }
  return undefined;
};

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const firstWebUrl = (text: string): string | undefined => {
  const line = text.split(/\r?\n/).map((s) => s.trim()).find((s) => /^https?:\/\//i.test(s));
  return line || undefined;
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
  const [isDragging, setIsDragging] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const dragDepth = useRef(0);

  const handleDragEnter = () => {
    dragDepth.current++;
    setIsDragging(true);
  };
  const handleDragLeave = () => {
    dragDepth.current--;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const addLink = async (data: {
    link_type: "web" | "file" | "api";
    url: string;
    title?: string;
    description?: string;
  }): Promise<TaskLink | null> => {
    try {
      const created = await api.scheduler.createLink(taskId, {
        link_type: data.link_type,
        url: data.url,
        title: data.title || undefined,
        description: data.description || undefined,
      });
      setLinks((prev) => [created, ...prev]);
      return created;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : t('scheduler.taskLinks.dropAddFailed');
      messageHelper.error(errMsg);
      return null;
    }
  };

  const handleDropUrl = async (url: string) => {
    const fallbackTitle = hostnameOf(url);
    setIsResolving(true);
    try {
      const meta = await api.scheduler.getLinkMetadata(url);
      await addLink({
        link_type: "web",
        url,
        title: meta.title || fallbackTitle,
        description: meta.description || undefined,
      });
      messageHelper.success(t('scheduler.taskLinks.dropAdded'));
    } catch {
      // 元数据识别失败 → 回退为纯 URL
      await addLink({ link_type: "web", url, title: fallbackTitle });
      messageHelper.success(t('scheduler.taskLinks.dropAdded'));
    } finally {
      setIsResolving(false);
    }
  };

  const handleDropFiles = async (files: File[]) => {
    let added = 0;
    for (const file of files) {
      const path = getFilePath(file);
      const url = path
        ? `file:///${path.replace(/\\/g, "/")}`
        : `file:///${encodeURIComponent(file.name)}`;
      const sizeLabel = formatBytes(file.size);
      const created = await addLink({
        link_type: "file",
        url,
        title: file.name,
        description: [file.type, sizeLabel].filter(Boolean).join(" · ") || undefined,
      });
      if (created) added++;
    }
    if (added > 0) messageHelper.success(t('scheduler.taskLinks.dropFilesAdded', { count: added }));
    else if (files.length > 0) messageHelper.error(t('scheduler.taskLinks.dropAddFailed'));
  };

  const handleDropEvent = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      await handleDropFiles(files);
      return;
    }
    // Edge/Chrome 拖拽标签页或链接：URL 可能只在 text/uri-list 或 text/plain 中，
    // 某些场景（拖拽外部标签页）还需要从 text/html 的 href 兜底提取。
    const raw = `${e.dataTransfer.getData("text/uri-list")}\n${e.dataTransfer.getData("text/plain")}`;
    let url = firstWebUrl(raw);
    if (!url) {
      const html = e.dataTransfer.getData("text/html");
      const href = /href=["'](https?:\/\/[^"']+)["']/i.exec(html)?.[1];
      url = href;
    }
    if (url) {
      await handleDropUrl(url);
    } else {
      messageHelper.error(t('scheduler.taskLinks.dropInvalid'));
    }
  };

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

  const handleOpenLink = async (link: TaskLink) => {
    if (link.link_type === "web") {
      window.open(link.url, "_blank", "noopener,noreferrer");
    } else if (link.link_type === "file") {
      // 本地文件仅桌面版可用系统默认软件打开；网页端浏览器禁止 file:// 访问
      if (isElectron() && window.electronAPI?.shell?.openPath) {
        try {
          // file:///C:/... → 去掉 file:/// 三个斜杠后为 C:/...
          const filePath = link.url.replace(/^file:\/\/\//i, "");
          const res = await window.electronAPI.shell.openPath(filePath);
          if (res?.success) {
            messageHelper.success(t('scheduler.taskLinks.openFileSuccess'));
          } else if (res?.error) {
            messageHelper.error(t('scheduler.taskLinks.openFileFailed', { error: res.error }));
          } else {
            messageHelper.error(t('scheduler.taskLinks.openFileNoHandler'));
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : t('scheduler.taskLinks.openFileNoHandler');
          messageHelper.error(errMsg);
        }
      } else {
        messageHelper.info(t('scheduler.taskLinks.openFileDesktopOnly'));
      }
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
          {/* 拖拽区 */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={handleDragLeave}
            onDrop={handleDropEvent}
            className={`mb-3 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed text-sm transition-all ${
              isDragging
                ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400"
                : isResolving
                  ? "border-primary-300 dark:border-primary-500/40 text-slate-500 dark:text-slate-400"
                  : "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-primary-400 dark:hover:border-primary-500/50"
            }`}
          >
            {isResolving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('scheduler.taskLinks.resolving')}
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                {t('scheduler.taskLinks.dropHint')}
              </>
            )}
          </div>

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
