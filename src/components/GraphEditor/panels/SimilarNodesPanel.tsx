import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, GitMerge, Loader2, Check, AlertTriangle, ScanSearch } from "lucide-react";
import { useFocusTrap, useEscapeKey } from "../../../hooks/common";
import {
  findSimilarNodePairs,
  formatSimilarity,
  type NodeSimilarityPair,
} from "../../../utils/graph/nodeSimilarity";

interface SimilarNodesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Array<{ id: string; title: string; content?: string }>;
  onMerge: (keeperId: string, removeId: string) => Promise<boolean>;
  onNodeClick?: (nodeId: string) => void;
}

export const SimilarNodesPanel: React.FC<SimilarNodesPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  onMerge,
  onNodeClick,
}) => {
  const { t } = useTranslation();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  const [mergingId, setMergingId] = useState<string | null>(null);
  const [donePairs, setDonePairs] = useState<Set<string>>(new Set());

  const pairs = useMemo(() => {
    if (!isOpen || nodes.length < 2) return [];
    return findSimilarNodePairs(nodes, 0.72, 50);
  }, [isOpen, nodes]);

  if (!isOpen) return null;

  const pairKey = (p: NodeSimilarityPair) => `${p.a.id}|${p.b.id}`;

  const handleMerge = async (p: NodeSimilarityPair) => {
    const key = pairKey(p);
    setMergingId(key);
    try {
      const ok = await onMerge(p.a.id, p.b.id);
      if (ok) {
        setDonePairs(prev => new Set(prev).add(key));
      }
    } finally {
      setMergingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("graphEditor.similarNodes.title")}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ScanSearch className="text-primary-500" size={20} />
            {t("graphEditor.similarNodes.title")}
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
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {nodes.length < 2 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("graphEditor.similarNodes.needAtLeastTwo")}
            </p>
          ) : pairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Check size={36} className="text-green-500 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {t("graphEditor.similarNodes.noDuplicates")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t("graphEditor.similarNodes.noDuplicatesDesc")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle size={16} />
                <span>
                  {t("graphEditor.similarNodes.found", { count: pairs.length })}
                </span>
              </div>
              {pairs.map((p) => {
                const key = pairKey(p);
                const isDone = donePairs.has(key);
                const isMerging = mergingId === key;
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-lg border transition-all ${
                      isDone
                        ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 opacity-70"
                        : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          p.score >= 0.85
                            ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                            : p.score >= 0.78
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
                              : "bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {formatSimilarity(p.score)}
                      </span>
                      {isDone && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check size={14} />
                          {t("graphEditor.similarNodes.merged")}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {[p.a, p.b].map((n, idx) => (
                        <button
                          key={`${key}-${idx}`}
                          onClick={() => onNodeClick?.(n.id)}
                          className="w-full text-left flex items-start gap-2 hover:bg-white dark:hover:bg-slate-600 rounded px-2 py-1 transition-colors"
                        >
                          <span
                            className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              idx === 0
                                ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300"
                                : "bg-gray-200 dark:bg-slate-500 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {idx === 0
                              ? t("graphEditor.similarNodes.keep")
                              : t("graphEditor.similarNodes.remove")}
                          </span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 break-all">
                            {n.title}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!isDone && (
                      <button
                        onClick={() => handleMerge(p)}
                        disabled={isMerging}
                        className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isMerging ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <GitMerge size={14} />
                        )}
                        {isMerging
                          ? t("graphEditor.similarNodes.merging")
                          : t("graphEditor.similarNodes.mergeAction")}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t("graphEditor.similarNodes.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimilarNodesPanel;
