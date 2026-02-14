import React, { useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Play,
  ChevronRight,
  Target,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface LearningPathNode {
  id: string;
  node_id: string;
  node?: {
    id: string;
    title: string;
    level?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  estimated_minutes: number;
  difficulty_level: number;
}

interface LearningPathProgressProps {
  learningPath: {
    id: string;
    title: string;
    status: 'active' | 'completed' | 'paused' | 'archived';
    total_nodes: number;
    completed_nodes: number;
    progress_percentage: number;
    estimated_hours?: number;
    daily_minutes_target?: number;
    nodes: LearningPathNode[];
  } | null;
  currentNodeId?: string;
  onNodeClick: (nodeId: string) => void;
  compact?: boolean;
}

export const LearningPathProgress: React.FC<LearningPathProgressProps> = ({
  learningPath,
  currentNodeId,
  onNodeClick,
  compact = false
}) => {
  const { isDark } = useTheme();

  const stats = useMemo(() => {
    if (!learningPath) return null;
    
    const nodes = learningPath.nodes || [];
    const completed = nodes.filter(n => n.status === 'completed').length;
    const inProgress = nodes.filter(n => n.status === 'in_progress').length;
    const pending = nodes.filter(n => n.status === 'pending').length;
    const totalMinutes = nodes.reduce((sum, n) => sum + n.estimated_minutes, 0);
    const completedMinutes = nodes
      .filter(n => n.status === 'completed')
      .reduce((sum, n) => sum + n.estimated_minutes, 0);
    
    const currentNodeIndex = nodes.findIndex(n => n.node_id === currentNodeId);
    const currentNode = currentNodeIndex >= 0 ? nodes[currentNodeIndex] : null;
    
    return {
      completed,
      inProgress,
      pending,
      totalMinutes,
      completedMinutes,
      currentNodeIndex,
      currentNode,
      remainingNodes: nodes.length - completed,
      averageDifficulty: nodes.length > 0 
        ? nodes.reduce((sum, n) => sum + n.difficulty_level, 0) / nodes.length 
        : 0
    };
  }, [learningPath, currentNodeId]);

  if (!learningPath) {
    return (
      <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <Target className="w-5 h-5" />
          <span className="text-sm">尚未创建学习路径</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{learningPath.title}</span>
          <span className="text-xs text-gray-500">{(learningPath.progress_percentage ?? 0).toFixed(0)}%</span>
        </div>
        <div className={`h-2 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
          <div 
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${learningPath.progress_percentage ?? 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{stats?.completed}/{learningPath.total_nodes ?? 0} 已完成</span>
          <span>{stats?.remainingNodes ?? 0} 剩余</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border border-gray-200'}`}>
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold">{learningPath.title}</h3>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            learningPath.status === 'active' 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : learningPath.status === 'completed'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {learningPath.status === 'active' ? '进行中' : learningPath.status === 'completed' ? '已完成' : '已暂停'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{stats?.completed}</div>
            <div className="text-xs text-gray-500">已完成</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
              <Play className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{stats?.inProgress}</div>
            <div className="text-xs text-gray-500">进行中</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <Circle className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{stats?.pending}</div>
            <div className="text-xs text-gray-500">待学习</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-center gap-1 text-purple-500 mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xl font-bold">{Math.round((stats?.totalMinutes || 0) / 60)}</div>
            <div className="text-xs text-gray-500">总时长(h)</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">学习进度</span>
            <span className="text-sm font-medium">{(learningPath.progress_percentage ?? 0).toFixed(1)}%</span>
          </div>
          <div className={`h-3 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`}>
            <div 
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${learningPath.progress_percentage ?? 0}%` }}
            />
          </div>
        </div>

        {stats?.currentNode && (
          <div className={`p-3 rounded-lg border-2 border-indigo-500 ${isDark ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">当前学习</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{stats.currentNode.node?.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  第 {(stats.currentNodeIndex ?? 0) + 1} / {learningPath.total_nodes ?? 0} 个知识点
                </div>
              </div>
              <button
                onClick={() => stats.currentNode?.node && onNodeClick(stats.currentNode.node.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                继续
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <h4 className="text-sm font-medium mb-3">学习路径预览</h4>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {(learningPath.nodes || []).slice(0, 10).map((node, index) => (
              <React.Fragment key={node.id}>
                <button
                  onClick={() => node.node && onNodeClick(node.node.id)}
                  className={`
                    flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                    transition-all hover:scale-110
                    ${node.status === 'completed' 
                      ? 'bg-green-500 text-white' 
                      : node.status === 'in_progress'
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : node.node_id === currentNodeId
                      ? 'bg-indigo-500 text-white'
                      : isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-600'
                    }
                  `}
                  title={node.node?.title}
                >
                  {node.status === 'completed' ? '✓' : index + 1}
                </button>
                {index < Math.min((learningPath.nodes || []).length, 10) - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
            {(learningPath.nodes || []).length > 10 && (
              <span className="text-xs text-gray-500 ml-2">+{(learningPath.nodes || []).length - 10} 更多</span>
            )}
          </div>
        </div>

        {learningPath.daily_minutes_target && (
          <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm">每日目标</span>
              </div>
              <span className="text-sm font-medium">{learningPath.daily_minutes_target} 分钟/天</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
