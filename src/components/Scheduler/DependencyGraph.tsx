import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GitBranch, CheckCircle, Lock, Unlock } from "lucide-react";
import { ScheduledTask } from "@shared/types";

interface DependencyGraphProps {
  tasks: ScheduledTask[];
  className?: string;
  onTaskClick?: (task: ScheduledTask) => void;
}

interface TaskNode {
  task: ScheduledTask;
  x: number;
  y: number;
  isBlocked: boolean;
  blockingTasks: ScheduledTask[];
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  tasks,
  className = "",
  onTaskClick,
}) => {
  const [nodes, setNodes] = useState<TaskNode[]>([]);

  const calculateLayout = () => {
    const taskMap = new Map<string, ScheduledTask>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    const nodesWithPositions: TaskNode[] = tasks.map((task, index) => {
      const dependsOn = (task as any).depends_on || [];
      const blockingTasks = dependsOn
        .map((id: string) => taskMap.get(id))
        .filter(Boolean) as ScheduledTask[];

      const isBlocked = blockingTasks.some((t) => t.status !== "completed");

      const row = Math.floor(index / 3);
      const col = index % 3;

      return {
        task,
        x: 100 + col * 200,
        y: 80 + row * 120,
        isBlocked,
        blockingTasks,
      };
    });

    setNodes(nodesWithPositions);
  };

  useEffect(() => {
    calculateLayout();
  }, [tasks]);

  const getNodeColor = (node: TaskNode) => {
    if (node.task.status === "completed") return "#10b981";
    if (node.isBlocked) return "#f59e0b";
    if (node.task.status === "in_progress") return "#06b6d4";
    return "#64748b";
  };

  const renderConnections = () => {
    const connections: JSX.Element[] = [];

    nodes.forEach((node) => {
      node.blockingTasks.forEach((blockingTask) => {
        const blockingNode = nodes.find((n) => n.task.id === blockingTask.id);
        if (blockingNode) {
          connections.push(
            <line
              key={`${blockingTask.id}-${node.task.id}`}
              x1={blockingNode.x + 60}
              y1={blockingNode.y + 25}
              x2={node.x}
              y2={node.y + 25}
              stroke={
                blockingTask.status === "completed" ? "#10b981" : "#f59e0b"
              }
              strokeWidth="2"
              strokeDasharray={
                blockingTask.status === "completed" ? "0" : "5,5"
              }
              markerEnd="url(#arrowhead)"
            />,
          );
        }
      });
    });

    return connections;
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 ${className}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl">
          <GitBranch size={20} className="text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            任务依赖关系
          </h3>
          <p className="text-xs text-slate-500">可视化任务之间的依赖</p>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <GitBranch size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无任务依赖关系</p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <svg
            width="100%"
            height={Math.max(200, Math.ceil(nodes.length / 3) * 120 + 40)}
            viewBox="0 0 700 400"
            className="min-w-[600px]"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
            </defs>

            {renderConnections()}

            {nodes.map((node, index) => (
              <g
                key={node.task.id}
                className="cursor-pointer"
                onClick={() => {
                  onTaskClick?.(node.task);
                }}
              >
                <motion.rect
                  x={node.x}
                  y={node.y}
                  width="120"
                  height="50"
                  rx="8"
                  fill={getNodeColor(node)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:opacity-90 transition-opacity"
                />

                {node.isBlocked && (
                  <g transform={`translate(${node.x + 95}, ${node.y + 5})`}>
                    <circle r="10" fill="#f59e0b" />
                    <Lock
                      size={12}
                      fill="white"
                      stroke="white"
                      strokeWidth="1"
                      x="-6"
                      y="-6"
                    />
                  </g>
                )}

                {node.task.status === "completed" && (
                  <g transform={`translate(${node.x + 95}, ${node.y + 5})`}>
                    <circle r="10" fill="#10b981" />
                    <CheckCircle
                      size={12}
                      fill="white"
                      stroke="white"
                      strokeWidth="1"
                      x="-6"
                      y="-6"
                    />
                  </g>
                )}

                <text
                  x={node.x + 60}
                  y={node.y + 30}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="500"
                  className="pointer-events-none"
                >
                  {node.task.title.length > 12
                    ? `${node.task.title.slice(0, 12)}...`
                    : node.task.title}
                </text>
              </g>
            ))}
          </svg>

          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>已完成</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-cyan-500" />
              <span>进行中</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>被阻塞</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-slate-500" />
              <span>待处理</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DependencyIndicatorProps {
  blockingTasks?: ScheduledTask[];
  className?: string;
}

export const DependencyIndicator: React.FC<DependencyIndicatorProps> = ({
  blockingTasks = [],
  className = "",
}) => {
  const isBlocked = blockingTasks.some((t) => t.status !== "completed");
  const pendingBlockers = blockingTasks.filter((t) => t.status !== "completed");

  if (blockingTasks.length === 0) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {isBlocked ? (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
          <Lock size={10} />
          <span>等待 {pendingBlockers.length} 个任务</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
          <Unlock size={10} />
          <span>已解锁</span>
        </div>
      )}
    </div>
  );
};
