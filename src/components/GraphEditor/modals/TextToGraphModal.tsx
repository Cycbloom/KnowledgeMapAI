import React, { useState, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  FileText,
  Sparkles,
  Loader2,
  Check,
  Network,
  RefreshCw,
  Info,
  FolderOpen,
} from "lucide-react";
import { api } from "../../../services/api";
import { message } from "../../../utils/messageHelper";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";

interface TextToGraphNode {
  id?: string;
  title?: string;
  content?: string;
  level?: string;
}

interface TextToGraphEdge {
  source?: string;
  target?: string;
  relationship?: string;
  relationship_type?: string;
}

interface TextToGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  onSaved?: () => void;
}

interface PreviewNode extends TextToGraphNode {
  _id: string;
  _children: PreviewNode[];
}

export const TextToGraphModal: React.FC<TextToGraphModalProps> = ({
  isOpen,
  onClose,
  graphId,
  onSaved,
}) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<TextToGraphNode[]>([]);
  const [edges, setEdges] = useState<TextToGraphEdge[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setText("");
      setNodes([]);
      setEdges([]);
      setAnalyzed(false);
      setError(null);
      setSelectedFileName(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImportFile = () => {
    fileInputRef.current?.click();
  };

  // 二进制格式：无法在前端读取为文本，需上传后端解析（document-to-graph）
  const BINARY_FILE_EXTENSIONS = [".pdf", ".ppt", ".pptx"];

  const handleDocumentUpload = async (file: File) => {
    setAnalyzing(true);
    setError(null);
    setText("");
    setNodes([]);
    setEdges([]);
    setAnalyzed(false);
    setSelectedFileName(file.name);
    try {
      const result = await api.ai.documentToGraph({
        graph_id: graphId,
        file,
      });
      const parsed = result as {
        nodes?: TextToGraphNode[];
        edges?: TextToGraphEdge[];
      };
      setNodes(parsed.nodes || []);
      setEdges(parsed.edges || []);
      setAnalyzed(true);
      if ((parsed.nodes || []).length === 0) {
        message.info(t("graphEditor.textToGraph.noNodesFound"));
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.textToGraph.analyzeFailed");
      setError(errMsg);
      message.error(errMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 重置 value，确保再次选择同一文件时仍触发 change 事件
    e.target.value = "";
    if (!file) return;

    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (BINARY_FILE_EXTENSIONS.includes(ext)) {
      void handleDocumentUpload(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setText(content);
      setSelectedFileName(file.name);
      setNodes([]);
      setEdges([]);
      setAnalyzed(false);
      setError(null);
    };
    reader.onerror = () => {
      const errMsg = t("graphEditor.textToGraph.fileReadFailed");
      setError(errMsg);
      message.error(errMsg);
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    if (!text || text.trim().length < 10) {
      message.warning(t("graphEditor.textToGraph.minLength"));
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const result = await api.ai.textToGraph({
        text,
        graph_id: graphId,
        action: "analyze",
      });
      const parsed = result as {
        nodes?: TextToGraphNode[];
        edges?: TextToGraphEdge[];
      };
      setNodes(parsed.nodes || []);
      setEdges(parsed.edges || []);
      setAnalyzed(true);
      if ((parsed.nodes || []).length === 0) {
        message.info(t("graphEditor.textToGraph.noNodesFound"));
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.textToGraph.analyzeFailed");
      setError(errMsg);
      message.error(errMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (nodes.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.ai.textToGraph({
        graph_id: graphId,
        action: "save",
        nodes,
        edges,
      });
      message.success(t("graphEditor.textToGraph.saveSuccess"));
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("graphEditor.textToGraph.saveFailed");
      setError(errMsg);
      message.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Build a tree preview from nodes + edges
  const buildPreviewTree = (): PreviewNode[] => {
    const nodeById = new Map<string, PreviewNode>();
    nodes.forEach((n, idx) => {
      nodeById.set(n.id || `n${idx}`, {
        ...n,
        _id: n.id || `n${idx}`,
        _children: [],
      });
    });
    const childIds = new Set<string>();
    edges.forEach((e) => {
      const source = nodeById.get(e.source || "");
      const target = nodeById.get(e.target || "");
      if (source && target) {
        source._children.push(target);
        childIds.add(target._id);
      }
    });
    // Root = nodes that are not anyone's child; fallback to all
    const roots = nodes
      .map((n, idx) => nodeById.get(n.id || `n${idx}`))
      .filter((n): n is PreviewNode => Boolean(n))
      .filter((n) => !childIds.has(n._id));
    return roots.length > 0 ? roots : Array.from(nodeById.values());
  };

  const renderPreviewNode = (node: PreviewNode, depth: number) => (
    <div key={node._id} className="ml-4 border-l border-gray-200 dark:border-slate-700 pl-3 py-0.5">
      <div className="flex items-center gap-2 text-sm">
        <Network size={12} className="text-primary-500 flex-shrink-0" />
        <span className="font-medium text-gray-800 dark:text-gray-200">{node.title}</span>
        {node.level && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
            {node.level}
          </span>
        )}
      </div>
      {node.content && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
          {node.content}
        </p>
      )}
      {node._children.map((child) => renderPreviewNode(child, depth + 1))}
    </div>
  );

  const previewTree = buildPreviewTree();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${textareaId}-title`}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 id={`${textareaId}-title`} className="text-lg font-bold flex items-center gap-2">
            <FileText className="text-primary-500" size={20} />
            {t("graphEditor.textToGraph.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.aria.close")}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5 text-primary-400" />
            {t("graphEditor.textToGraph.description")}
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={textareaId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("graphEditor.textToGraph.inputLabel")}
              </label>
              <button
                type="button"
                onClick={handleImportFile}
                title={t("graphEditor.textToGraph.fileFormatsHint")}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 px-2 py-1 rounded-md transition-colors"
              >
                <FolderOpen size={14} />
                {t("graphEditor.textToGraph.importFromFile")}
              </button>
            </div>
            <textarea
              id={textareaId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={t("graphEditor.textToGraph.placeholder")}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt,.opml,.json,.xml,.csv,.html,.htm,.pdf,.ppt,.pptx"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            {selectedFileName && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <FileText size={12} className="text-primary-500 flex-shrink-0" />
                <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[16rem]">
                  {selectedFileName}
                </span>
                <span>{t("graphEditor.textToGraph.fileLoaded")}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || saving || !text.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {analyzing
                ? t("graphEditor.textToGraph.analyzing")
                : t("graphEditor.textToGraph.analyze")}
            </button>
            {analyzed && nodes.length > 0 && (
              <button
                onClick={() => {
                  setText("");
                  setNodes([]);
                  setEdges([]);
                  setAnalyzed(false);
                  setSelectedFileName(null);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <RefreshCw size={14} />
                {t("graphEditor.textToGraph.reset")}
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {analyzed && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <Check size={16} className="text-green-500" />
                  {t("graphEditor.textToGraph.previewTitle", {
                    count: nodes.length,
                  })}
                </h3>
              </div>
              {previewTree.length > 0 ? (
                <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3 max-h-56 overflow-y-auto bg-gray-50 dark:bg-slate-700/40">
                  {previewTree.map((node) => renderPreviewNode(node, 0))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t("graphEditor.textToGraph.noNodesFound")}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t("graphEditor.textToGraph.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!analyzed || nodes.length === 0 || saving}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving
              ? t("graphEditor.textToGraph.saving")
              : t("graphEditor.textToGraph.saveToGraph")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextToGraphModal;
