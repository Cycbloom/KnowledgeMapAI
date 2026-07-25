import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertTriangle, Loader2, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  agentApi,
  type PendingAction,
  type RiskLevel,
} from "../../services/api/agent";

interface ActionConfirmationPanelProps {
  sessionId: string;
  pendingActions: PendingAction[];
  onActionConfirmed: (actionId: string, result: unknown) => void;
  onActionRejected: (actionId: string) => void;
  onAllActionsResolved: () => void;
}

const TOOL_NAME_KEYS: Record<string, string> = {
  create_node: "graphMap.actionConfirmation.tool.createNode",
  create_edge: "graphMap.actionConfirmation.tool.createEdge",
  create_graph_relation: "graphMap.actionConfirmation.tool.createGraphRelation",
  create_study_card: "graphMap.actionConfirmation.tool.createStudyCard",
  update_node: "graphMap.actionConfirmation.tool.updateNode",
};

const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { labelKey: string; bgColor: string; textColor: string }
> = {
  low: {
    labelKey: "graphMap.actionConfirmation.riskLevel.low",
    bgColor: "bg-green-100 dark:bg-green-900/40",
    textColor: "text-green-700 dark:text-green-300",
  },
  medium: {
    labelKey: "graphMap.actionConfirmation.riskLevel.medium",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/40",
    textColor: "text-yellow-700 dark:text-yellow-300",
  },
  high: {
    labelKey: "graphMap.actionConfirmation.riskLevel.high",
    bgColor: "bg-red-100 dark:bg-red-900/40",
    textColor: "text-red-700 dark:text-red-300",
  },
};

interface ActionResult {
  success: boolean;
  result?: unknown;
}

export const ActionConfirmationPanel: React.FC<
  ActionConfirmationPanelProps
> = ({
  sessionId,
  pendingActions,
  onActionConfirmed,
  onActionRejected,
  onAllActionsResolved,
}) => {
  const { t } = useTranslation();
  const [processingActions, setProcessingActions] = useState<Set<string>>(
    new Set(),
  );
  const [actionResults, setActionResults] = useState<
    Map<string, ActionResult>
  >(new Map());

  const pendingOnly = pendingActions.filter(
    (a) => a.status === "pending" && !actionResults.has(a.id),
  );
  const allResolved =
    pendingActions.length > 0 && pendingOnly.length === 0;

  const checkAllResolved = useCallback(
    (currentResults: Map<string, ActionResult>) => {
      const stillPending = pendingActions.filter(
        (a) => a.status === "pending" && !currentResults.has(a.id),
      );
      if (stillPending.length === 0 && pendingActions.length > 0) {
        onAllActionsResolved();
      }
    },
    [pendingActions, onAllActionsResolved],
  );

  const handleConfirm = useCallback(
    async (actionId: string) => {
      setProcessingActions((prev) => new Set(prev).add(actionId));
      try {
        const response = await agentApi.confirmAction(sessionId, actionId);
        const result: ActionResult = {
          success: response.success,
          result: response.result,
        };
        setActionResults((prev) => {
          const next = new Map(prev);
          next.set(actionId, result);
          checkAllResolved(next);
          return next;
        });
        onActionConfirmed(actionId, response.result);
      } catch {
        const result: ActionResult = { success: false };
        setActionResults((prev) => {
          const next = new Map(prev);
          next.set(actionId, result);
          checkAllResolved(next);
          return next;
        });
      } finally {
        setProcessingActions((prev) => {
          const next = new Set(prev);
          next.delete(actionId);
          return next;
        });
      }
    },
    [sessionId, onActionConfirmed, checkAllResolved],
  );

  const handleReject = useCallback(
    async (actionId: string) => {
      setProcessingActions((prev) => new Set(prev).add(actionId));
      try {
        await agentApi.rejectAction(sessionId, actionId);
        const result: ActionResult = { success: true };
        setActionResults((prev) => {
          const next = new Map(prev);
          next.set(actionId, result);
          checkAllResolved(next);
          return next;
        });
        onActionRejected(actionId);
      } catch {
        const result: ActionResult = { success: false };
        setActionResults((prev) => {
          const next = new Map(prev);
          next.set(actionId, result);
          checkAllResolved(next);
          return next;
        });
      } finally {
        setProcessingActions((prev) => {
          const next = new Set(prev);
          next.delete(actionId);
          return next;
        });
      }
    },
    [sessionId, onActionRejected, checkAllResolved],
  );

  const handleBatchConfirm = useCallback(async () => {
    const ids = pendingOnly.map((a) => a.id);
    if (ids.length === 0) return;

    setProcessingActions((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    try {
      const response = await agentApi.batchConfirmActions(sessionId, ids);
      const newResults = new Map(actionResults);
      response.results.forEach((r) => {
        newResults.set(r.actionId, { success: r.success, result: r.result });
        if (r.success) {
          onActionConfirmed(r.actionId, r.result);
        }
      });
      setActionResults(newResults);
      checkAllResolved(newResults);
    } catch {
      const newResults = new Map(actionResults);
      ids.forEach((id) => newResults.set(id, { success: false }));
      setActionResults(newResults);
      checkAllResolved(newResults);
    } finally {
      setProcessingActions((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [sessionId, pendingOnly, actionResults, onActionConfirmed, checkAllResolved]);

  const handleBatchReject = useCallback(async () => {
    const ids = pendingOnly.map((a) => a.id);
    if (ids.length === 0) return;

    setProcessingActions((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    try {
      const response = await agentApi.batchRejectActions(sessionId, ids);
      const newResults = new Map(actionResults);
      response.results.forEach((r) => {
        newResults.set(r.actionId, { success: r.success });
        if (r.success) {
          onActionRejected(r.actionId);
        }
      });
      setActionResults(newResults);
      checkAllResolved(newResults);
    } catch {
      const newResults = new Map(actionResults);
      ids.forEach((id) => newResults.set(id, { success: false }));
      setActionResults(newResults);
      checkAllResolved(newResults);
    } finally {
      setProcessingActions((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [sessionId, pendingOnly, actionResults, onActionRejected, checkAllResolved]);

  const isBatchProcessing = processingActions.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t("graphMap.actionConfirmation.title")}
        </h3>
        {pendingOnly.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
            {pendingOnly.length}
          </span>
        )}
      </div>

      {pendingOnly.length >= 2 && (
        <div className="flex gap-2">
          <button
            onClick={handleBatchConfirm}
            disabled={isBatchProcessing}
            className="flex-1 px-3 py-2 text-sm font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {t("graphMap.actionConfirmation.batchConfirm")}
          </button>
          <button
            onClick={handleBatchReject}
            disabled={isBatchProcessing}
            className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            {t("graphMap.actionConfirmation.batchReject")}
          </button>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {pendingActions.map((action) => {
          const isProcessing = processingActions.has(action.id);
          const actionResult = actionResults.get(action.id);
          const isResolved = actionResult !== undefined;
          const riskConfig = RISK_LEVEL_CONFIG[action.riskLevel];
          const toolKey = TOOL_NAME_KEYS[action.toolName];
          const toolLabel = toolKey
            ? (t(toolKey, { defaultValue: "" }) || action.toolName)
            : action.toolName;

          return (
            <motion.div
              key={action.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
              transition={{ duration: 0.2 }}
              className={`p-3 rounded-lg border ${
                isResolved
                  ? actionResult.success
                    ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                    : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                  : "border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${riskConfig.bgColor} ${riskConfig.textColor}`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {t(riskConfig.labelKey, { defaultValue: "" })}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300">
                      {toolLabel}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </div>

              {isResolved ? (
                <div className="mt-2 flex items-center gap-1.5 text-sm">
                  {actionResult.success ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">
                        {t("graphMap.actionConfirmation.executeSuccess")}
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">
                        {t("graphMap.actionConfirmation.executeFailed")}
                      </span>
                    </>
                  )}
                </div>
              ) : isProcessing ? (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("graphMap.actionConfirmation.executing")}</span>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleConfirm(action.id)}
                    disabled={isBatchProcessing}
                    className="px-3 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t("graphMap.actionConfirmation.confirm")}
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    disabled={isBatchProcessing}
                    className="px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("graphMap.actionConfirmation.reject")}
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {allResolved && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
          {t("graphMap.actionConfirmation.allResolved")}
        </p>
      )}
    </div>
  );
};
