import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateUserTaskMutation,
  useUpdateUserTaskMutation,
  useDeleteUserTaskMutation,
  useStartUserTaskMutation,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
} from "./scheduler/useScheduler";
import { frontendEventBus } from "../services/timer/FrontendEventBus";
import { api } from "../services/api";
import type { UserTask, CreateUserTaskData, KnowledgePoint } from "@shared/types";

export interface TaskActionsState {
  showTaskForm: boolean;
  editingTask: UserTask | null;
  defaultQueueLevel: number;
  linkingTaskId: string | null;
  knowledgePointSearch: string;
  searchResults: KnowledgePoint[];
}

export interface TaskActions extends TaskActionsState {
  setShowTaskForm: (v: boolean) => void;
  setEditingTask: (t: UserTask | null) => void;
  setDefaultQueueLevel: (l: number) => void;
  setLinkingTaskId: (id: string | null) => void;
  setKnowledgePointSearch: (q: string) => void;
  setSearchResults: (r: KnowledgePoint[]) => void;
  handleCreateTask: (data: CreateUserTaskData) => Promise<void>;
  handleUpdateTask: (data: CreateUserTaskData) => Promise<void>;
  handleDeleteTask: (task: UserTask) => Promise<void>;
  handleStartTask: (task: UserTask) => Promise<void>;
  handlePauseTask: (task: UserTask) => Promise<void>;
  handleCompleteTask: (task: UserTask) => Promise<void>;
  handleLinkKnowledgePoint: (taskId: string, knowledgePointId: string) => Promise<void>;
  searchKnowledgePoints: (query: string) => Promise<void>;
  openAddTaskForm: (queueLevel?: number) => void;
  openEditTaskForm: (task: UserTask) => void;
  refetchQueues: () => void;
}

export const useTaskActions = (refetchQueues: () => void): TaskActions => {
  const { t } = useTranslation();

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<UserTask | null>(null);
  const [defaultQueueLevel, setDefaultQueueLevel] = useState<number>(2);
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);
  const [knowledgePointSearch, setKnowledgePointSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgePoint[]>([]);

  const createTaskMutation = useCreateUserTaskMutation();
  const updateTaskMutation = useUpdateUserTaskMutation();
  const deleteTaskMutation = useDeleteUserTaskMutation();
  const startTaskMutation = useStartUserTaskMutation();
  const pauseTaskMutation = usePauseUserTaskMutation();
  const completeTaskMutation = useCompleteUserTaskMutation();

  const handleCreateTask = async (data: CreateUserTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskCreateSuccess") });
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskCreateFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleUpdateTask = async (data: CreateUserTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskUpdateSuccess") });
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskUpdateFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleDeleteTask = async (task: UserTask) => {
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskDeleted") });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskDeleteFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleStartTask = async (task: UserTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskStarted") });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskStartFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handlePauseTask = async (task: UserTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskPaused") });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskPauseFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const handleCompleteTask = async (task: UserTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.taskCompleted") });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.taskCompleteFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const openAddTaskForm = (queueLevel: number = 2) => {
    setDefaultQueueLevel(queueLevel);
    setEditingTask(null);
    setShowTaskForm(true);
  };

  const openEditTaskForm = (task: UserTask) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleLinkKnowledgePoint = async (taskId: string, knowledgePointId: string) => {
    try {
      await api.scheduler.addTaskKnowledgePoint(taskId, {
        knowledge_point_id: knowledgePointId,
      });
      frontendEventBus.publish("message_show", { type: "success", content: t("unifiedWorkbench.messages.knowledgePointLinked") });
      setLinkingTaskId(null);
      setKnowledgePointSearch("");
      setSearchResults([]);
      refetchQueues();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("unifiedWorkbench.messages.knowledgePointLinkFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  const searchKnowledgePoints = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const result = await api.knowledgePoints.searchSimilar({ query, limit: 5 });
      if (result && Array.isArray(result)) {
        setSearchResults(result as unknown as KnowledgePoint[]);
      }
    } catch (err) {
      console.error("Failed to search knowledge points:", err);
    }
  }, []);

  return {
    showTaskForm,
    editingTask,
    defaultQueueLevel,
    linkingTaskId,
    knowledgePointSearch,
    searchResults,
    setShowTaskForm,
    setEditingTask,
    setDefaultQueueLevel,
    setLinkingTaskId,
    setKnowledgePointSearch,
    setSearchResults,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleStartTask,
    handlePauseTask,
    handleCompleteTask,
    handleLinkKnowledgePoint,
    searchKnowledgePoints,
    openAddTaskForm,
    openEditTaskForm,
    refetchQueues,
  };
};
