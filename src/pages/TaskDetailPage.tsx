import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../components/common";
import { TaskWorkbench } from "../components/Scheduler/TaskWorkbench";

const TaskDetailPage: React.FC = () => {
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
        <p className="text-slate-500 dark:text-slate-400">任务ID不存在</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <ErrorBoundary>
        <TaskWorkbench taskId={taskId} onBack={handleBack} onEdit={handleEdit} />
      </ErrorBoundary>
    </div>
  );
};

export default TaskDetailPage;
