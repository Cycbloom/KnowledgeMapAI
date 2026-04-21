import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { TaskDependency, ScheduledTask } from '../../types';

interface TaskDependencyGraphProps {
  taskId: string;
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  allTasks?: ScheduledTask[];
  onTaskClick?: (taskId: string) => void;
}

interface GraphNode {
  id: string;
  title: string;
  status: string;
  queueLevel: number;
  priority: number;
  isCurrent: boolean;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'strict' | 'soft';
}

export const TaskDependencyGraph: React.FC<TaskDependencyGraphProps> = ({
  taskId,
  dependencies,
  dependents,
  allTasks = [],
  onTaskClick,
}) => {
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];

    const currentTask = allTasks.find((t) => t.id === taskId);
    if (currentTask) {
      nodeMap.set(taskId, {
        id: taskId,
        title: currentTask.title,
        status: currentTask.status,
        queueLevel: currentTask.queue_level,
        priority: currentTask.priority,
        isCurrent: true,
        x: 200,
        y: 150,
      });
    } else {
      nodeMap.set(taskId, {
        id: taskId,
        title: '当前任务',
        status: 'pending',
        queueLevel: 0,
        priority: 0,
        isCurrent: true,
        x: 200,
        y: 150,
      });
    }

    dependencies.forEach((dep, index) => {
      const depTask = dep.depends_on_task;
      if (depTask) {
        nodeMap.set(dep.depends_on_task_id, {
          id: dep.depends_on_task_id,
          title: depTask.title,
          status: depTask.status,
          queueLevel: depTask.queue_level,
          priority: depTask.priority,
          isCurrent: false,
          x: 50,
          y: 50 + index * 80,
        });
        edgeList.push({
          from: dep.depends_on_task_id,
          to: taskId,
          type: dep.dependency_type,
        });
      }
    });

    dependents.forEach((dep, index) => {
      const depTask = dep.depends_on_task;
      if (depTask) {
        nodeMap.set(dep.task_id, {
          id: dep.task_id,
          title: depTask.title,
          status: depTask.status,
          queueLevel: depTask.queue_level,
          priority: depTask.priority,
          isCurrent: false,
          x: 350,
          y: 50 + index * 80,
        });
        edgeList.push({
          from: taskId,
          to: dep.task_id,
          type: dep.dependency_type,
        });
      }
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [taskId, dependencies, dependents, allTasks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-primary-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'in_progress':
        return 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
      default:
        return 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800';
    }
  };

  if (nodes.length <= 1) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无依赖关系</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-auto" style={{ minHeight: 200 }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ minHeight: 200 }}
      >
        {edges.map((edge, index) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const isStrict = edge.type === 'strict';
          const strokeColor = isStrict ? '#3B82F6' : '#9CA3AF';
          const strokeDasharray = isStrict ? 'none' : '5,5';

          return (
            <g key={index}>
              <line
                x1={fromNode.x + 100}
                y1={fromNode.y + 20}
                x2={toNode.x}
                y2={toNode.y + 20}
                stroke={strokeColor}
                strokeWidth={2}
                strokeDasharray={strokeDasharray}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
          </marker>
        </defs>
      </svg>

      {nodes.map((node) => (
        <div
          key={node.id}
          className={`absolute p-2 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${
            node.isCurrent
              ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-300'
              : getStatusColor(node.status)
          }`}
          style={{
            left: node.x,
            top: node.y,
            width: 100,
          }}
          onClick={() => !node.isCurrent && onTaskClick?.(node.id)}
        >
          <div className="flex items-center gap-1 mb-1">
            {getStatusIcon(node.status)}
            <span className="text-xs text-gray-500">Q{node.queueLevel}</span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {node.title}
          </p>
          {node.isCurrent && (
            <span className="absolute -top-2 -right-2 px-1 text-xs bg-primary-500 text-white rounded">
              当前
            </span>
          )}
        </div>
      ))}

      <div className="absolute bottom-0 right-0 flex items-center gap-4 text-xs text-gray-500 bg-white dark:bg-gray-800 p-2 rounded">
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-primary-500" />
          <span>严格依赖</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-0.5 bg-gray-400 border-dashed border-t-2 border-gray-400" />
          <span>软性依赖</span>
        </div>
      </div>
    </div>
  );
};
