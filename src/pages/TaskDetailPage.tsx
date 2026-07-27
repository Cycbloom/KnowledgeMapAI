import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "../components/common";
import { TaskWorkbench } from "../components/Scheduler/TaskWorkbench";

const TaskDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/scheduler");
  };

  const handleEdit = () => {
    navigate("/scheduler", { state: { editTaskId: taskId } });
  };

  if (!taskId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500 dark:text-slate-400">{t("tasks.taskIdNotExist")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <h1 className="sr-only">{t('tasks.detailTitle')}</h1>
      <ErrorBoundary>
        <TaskWorkbench taskId={taskId} onBack={handleBack} onEdit={handleEdit} />
      </ErrorBoundary>
    </div>
  );
};

export default TaskDetailPage;
