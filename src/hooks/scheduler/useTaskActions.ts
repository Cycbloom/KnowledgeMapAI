import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateUserTaskMutation,
  useUpdateUserTaskMutation,
  useDeleteUserTaskMutation,
  useStartUserTaskMutation,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
} from "./useScheduler";
import { message } from "../../utils/messageHelper";
import { api } from "../../services/api";
import { asyncConfirm } from "@/utils/asyncConfirm";
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
  // 竞态防护：记录最新一次搜索请求序号，仅当响应为最新请求时才写入结果，
  // 避免快速输入时旧请求晚到覆盖新结果。
  const searchSeqRef = useRef(0);

  const createTaskMutation = useCreateUserTaskMutation();
  const updateTaskMutation = useUpdateUserTaskMutation();
  const deleteTaskMutation = useDeleteUserTaskMutation();
  const startTaskMutation = useStartUserTaskMutation();
  const pauseTaskMutation = usePauseUserTaskMutation();
  const completeTaskMutation = useCompleteUserTaskMutation();

  const handleCreateTask = async (data: CreateUserTaskData) => {
    try {
      await createTaskMutation.mutateAsync(data);
      message.success(t("toast.workbench.taskCreateSuccess"));
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskCreateFailed");
      message.error(errorMessage);
    }
  };

  const handleUpdateTask = async (data: CreateUserTaskData) => {
    if (!editingTask) return;
    try {
      await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
      message.success(t("toast.workbench.taskUpdateSuccess"));
      setEditingTask(null);
      setShowTaskForm(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskUpdateFailed");
      message.error(errorMessage);
    }
  };

  const handleDeleteTask = async (task: UserTask) => {
    const confirmed = await asyncConfirm({
      title: t("scheduler.taskActions.deleteTaskConfirm.title"),
      message: t("scheduler.taskActions.deleteTaskConfirm.message"),
      isDangerous: true,
    });
    if (!confirmed) return;
    try {
      await deleteTaskMutation.mutateAsync(task.id);
      message.success(t("toast.workbench.taskDeleted"));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskDeleteFailed");
      message.error(errorMessage);
    }
  };

  const handleStartTask = async (task: UserTask) => {
    try {
      await startTaskMutation.mutateAsync(task.id);
      message.success(t("toast.workbench.taskStarted"));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskStartFailed");
      message.error(errorMessage);
    }
  };

  const handlePauseTask = async (task: UserTask) => {
    try {
      await pauseTaskMutation.mutateAsync(task.id);
      message.success(t("toast.workbench.taskPaused"));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskPauseFailed");
      message.error(errorMessage);
    }
  };

  const handleCompleteTask = async (task: UserTask) => {
    try {
      await completeTaskMutation.mutateAsync(task.id);
      message.success(t("toast.workbench.taskCompleted"));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.taskCompleteFailed");
      message.error(errorMessage);
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
      message.success(t("toast.workbench.knowledgePointLinked"));
      setLinkingTaskId(null);
      setKnowledgePointSearch("");
      setSearchResults([]);
      refetchQueues();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.workbench.knowledgePointLinkFailed");
      message.error(errorMessage);
    }
  };

  const searchKnowledgePoints = useCallback(async (query: string) => {
    if (!query.trim()) {
      searchSeqRef.current += 1;
      setSearchResults([]);
      return;
    }
    const seq = searchSeqRef.current + 1;
    searchSeqRef.current = seq;
    try {
      const result = await api.knowledgePoints.searchSimilar({ query, limit: 5 });
      // 仅当此响应仍是最新请求时才写入，丢弃过期响应
      if (searchSeqRef.current !== seq) return;
      if (result && Array.isArray(result)) {
        setSearchResults(result as unknown as KnowledgePoint[]);
      }
    } catch (err) {
      if (searchSeqRef.current !== seq) return;
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