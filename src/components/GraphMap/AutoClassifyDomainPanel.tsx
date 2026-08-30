import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2, CheckCircle2, Layers, Circle } from "lucide-react";
import { api } from "../../services/api";
import { domainsApi, type AutoClassifiedDomain } from "../../services/api/domains";
import { message } from "../../utils/messageHelper";
import { getErrorMessage } from "../../utils/errors";

interface AutoClassifyDomainPanelProps {
  isOpen: boolean;
  /** 从后台任务加载候选结果（由完成通知「继续」传入） */
  initialTaskId?: string | null;
  onClose: () => void;
  onApplied: () => void;
}

type WorkDomain = AutoClassifiedDomain & { checked: boolean };

const AutoClassifyDomainPanelComponent: React.FC<
  AutoClassifyDomainPanelProps
> = ({ isOpen, initialTaskId, onClose, onApplied }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "review" | "applying">(
    "loading",
  );
  const [workDomains, setWorkDomains] = useState<WorkDomain[]>([]);
  const [graphCount, setGraphCount] = useState(0);

  // 从后台任务 output_data 加载候选领域（自动分类为后台任务，AI 聚类较耗时）
  useEffect(() => {
    if (!isOpen) return;
    setStatus("loading");
    setWorkDomains([]);
    setGraphCount(0);

    if (!initialTaskId) {
      setStatus("review");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const task = (await api.ai.getTaskStatus(initialTaskId)) as {
          status?: string;
          output_data?: {
            domains?: AutoClassifiedDomain[];
            graphs?: unknown[];
          };
        };
        if (cancelled) return;
        const list = Array.isArray(task?.output_data?.domains)
          ? task.output_data.domains
          : [];
        setWorkDomains(list.map((d) => ({ ...d, checked: true })));
        setGraphCount(
          Array.isArray(task?.output_data?.graphs)
            ? task.output_data.graphs.length
            : 0,
        );
        setStatus("review");
      } catch (error: unknown) {
        if (cancelled) return;
        const errMsg =
          getErrorMessage(error) || t("graphMap.autoClassify.analyzeFailed");
        message.error(errMsg);
        setStatus("review");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialTaskId, t]);

  const updateDomain = useCallback(
    (index: number, patch: Partial<WorkDomain>) => {
      setWorkDomains((prev) =>
        prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
      );
    },
    [],
  );

  const toggleGraph = useCallback((index: number, graphId: string) => {
    setWorkDomains((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const has = d.graph_ids.includes(graphId);
        return {
          ...d,
          graph_ids: has
            ? d.graph_ids.filter((gid) => gid !== graphId)
            : [...d.graph_ids, graphId],
        };
      }),
    );
  }, []);

  const handleApply = useCallback(async () => {
    const selected = workDomains.filter(
      (d) => d.checked && d.name.trim().length >= 2 && d.graph_ids.length > 0,
    );
    if (selected.length === 0) {
      message.warning(t("graphMap.autoClassify.noneSelected"));
      return;
    }

    setStatus("applying");
    try {
      const result = await domainsApi.applyClassify({
        domains: selected.map((d) => ({
          name: d.name.trim(),
          description: d.description?.trim(),
          graph_ids: d.graph_ids,
        })),
      });
      message.success(
        t("graphMap.autoClassify.appliedSuccess", {
          count: result.created.length,
        }),
      );
      onApplied();
    } catch (error: unknown) {
      const errMsg =
        getErrorMessage(error) || t("graphMap.autoClassify.applyFailed");
      message.error(errMsg);
      setStatus("review");
    }
  }, [workDomains, t, onApplied]);

  if (!isOpen) return null;

  const s = t;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s("graphMap.autoClassify.title")}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-auto flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {s("graphMap.autoClassify.titleReview")}
          </h2>
          <button
            onClick={onClose}
            aria-label={s("common.aria.close")}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {status === "loading" && (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-500 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {s("graphMap.autoClassify.loading")}
              </p>
            </div>
          )}

          {status === "review" && (
            <>
              {workDomains.length === 0 ? (
                <div className="text-center py-10">
                  <Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {s("graphMap.autoClassify.noOpenData")}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {s("graphMap.autoClassify.analyzedHint", {
                      count: graphCount,
                    })}
                  </p>
                  <div className="space-y-3">
                    {workDomains.map((domain, index) => (
                      <div
                        key={domain.suggestion_id}
                        className={`border rounded-lg p-3 transition-colors ${
                          domain.checked
                            ? "border-primary-300 dark:border-primary-700 bg-primary-50/40 dark:bg-primary-900/20"
                            : "border-gray-200 dark:border-gray-700 opacity-70"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={() =>
                              updateDomain(index, { checked: !domain.checked })
                            }
                            className="flex-shrink-0"
                            aria-label={s(
                              domain.checked
                                ? "graphMap.autoClassify.include"
                                : "graphMap.autoClassify.exclude",
                            )}
                          >
                            {domain.checked ? (
                              <CheckCircle2 className="w-5 h-5 text-primary-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                            )}
                          </button>
                          <input
                            value={domain.name}
                            onChange={(e) =>
                              updateDomain(index, { name: e.target.value })
                            }
                            className="flex-1 min-w-0 text-sm font-medium bg-transparent border border-transparent focus:border-primary-400 rounded px-1.5 py-1 text-gray-900 dark:text-white outline-none"
                            aria-label={s("graphMap.autoClassify.domainName")}
                          />
                          <span className="flex-shrink-0 text-xs text-gray-400">
                            {domain.graph_ids.length}{" "}
                            {s("graphMap.autoClassify.graphsUnit")}
                          </span>
                        </div>

                        <input
                          value={domain.description || ""}
                          onChange={(e) =>
                            updateDomain(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder={s(
                            "graphMap.autoClassify.descriptionPlaceholder",
                          )}
                          className="w-full text-xs mb-2 bg-transparent border border-transparent focus:border-primary-400 rounded px-1.5 py-1 text-gray-600 dark:text-gray-400 outline-none"
                          aria-label={s(
                            "graphMap.autoClassify.domainDescription",
                          )}
                        />

                        <div className="flex flex-wrap gap-1.5">
                          {domain.graph_ids.map((gid) => (
                            <button
                              key={gid}
                              type="button"
                              onClick={() => toggleGraph(index, gid)}
                              title={s("graphMap.autoClassify.toggleGraph")}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200"
                            >
                              {domain.graph_titles[
                                domain.graph_ids.indexOf(gid)
                              ] || gid}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {status === "review" && workDomains.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {s("graphMap.autoClassify.cancel")}
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {s("graphMap.autoClassify.apply")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const AutoClassifyDomainPanel = React.memo(
  AutoClassifyDomainPanelComponent,
);