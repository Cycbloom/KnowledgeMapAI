import React, { useState, useEffect } from "react";
import {
  Plus,
  ExternalLink,
  FileText,
  Code,
  Trash2,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../services/api";
import { TaskLink } from "../../../types";
import { useMessageStore } from "../../../store/useMessageStore";

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

const getLinkTypeLabel = (type: string) => {
  switch (type) {
    case "web":
      return "网页";
    case "file":
      return "文件";
    case "api":
      return "API";
    default:
      return "链接";
  }
};

export const TaskLinks: React.FC<TaskLinksProps> = ({
  taskId,
  className = "",
}) => {
  const { addMessage } = useMessageStore();
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [newLink, setNewLink] = useState({
    link_type: "web" as "web" | "file" | "api",
    title: "",
    url: "",
    description: "",
  });

  useEffect(() => {
    loadLinks();
  }, [taskId]);

  const loadLinks = async () => {
    try {
      const response = await api.scheduler.getLinks(taskId);
      if (response.success) {
        setLinks(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load links:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!newLink.url.trim()) {
      addMessage({ type: "error", content: "请输入链接地址" });
      return;
    }

    try {
      const response = await api.scheduler.createLink(taskId, {
        link_type: newLink.link_type,
        title: newLink.title || undefined,
        url: newLink.url,
        description: newLink.description || undefined,
      });
      if (response.success) {
        setLinks([...links, response.data]);
        setNewLink({ link_type: "web", title: "", url: "", description: "" });
        setIsAdding(false);
        addMessage({ type: "success", content: "链接已添加" });
      }
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "添加链接失败" });
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const response = await api.scheduler.deleteLink(taskId, linkId);
      if (response.success) {
        setLinks(links.filter((l) => l.id !== linkId));
        addMessage({ type: "success", content: "链接已删除" });
      }
    } catch (error: any) {
      addMessage({ type: "error", content: error.message || "删除链接失败" });
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
            快速链接
          </h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {links.length} 个链接
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
        >
          <Plus size={14} />
          添加
        </button>
      </div>

      {isExpanded && (
        <>
          {isAdding && (
            <div className="mb-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
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
                          ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
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
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus
              />
              <input
                type="text"
                value={newLink.title}
                onChange={(e) =>
                  setNewLink({ ...newLink, title: e.target.value })
                }
                placeholder="标题（可选，默认使用链接地址）"
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <input
                type="text"
                value={newLink.description}
                onChange={(e) =>
                  setNewLink({ ...newLink, description: e.target.value })
                }
                placeholder="描述（可选）"
                className="w-full px-3 py-2 mb-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                  取消
                </button>
                <button
                  onClick={handleAddLink}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
                >
                  添加
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
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all group"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      link.link_type === "web"
                        ? "bg-blue-100 dark:bg-blue-500/20 text-blue-500"
                        : link.link_type === "file"
                          ? "bg-amber-100 dark:bg-amber-500/20 text-amber-500"
                          : "bg-purple-100 dark:bg-purple-500/20 text-purple-500"
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
                      className="p-1.5 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
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
              <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无链接</p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-2 text-sm text-cyan-500 hover:text-cyan-600"
                >
                  添加第一个链接
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
