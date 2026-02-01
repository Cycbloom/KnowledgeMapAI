import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks, useRetryTaskMutation, useDeleteTaskMutation } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, ArrowRight, Trash2, RotateCw } from 'lucide-react';

const formatTime = (iso?: string) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'processing':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'pending':
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'failed':
      return <XCircle className="w-4 h-4" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'pending':
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'generate_questions':
      return '自动生成题目';
    case 'expand_graph':
      return '自动扩展图谱';
    default:
      return type;
  }
};

const FilterTab = ({ label, value, current, onClick, count }: { label: string, value: string, current: string, onClick: (v: string) => void, count?: number }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
      current === value
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {label}
    {count !== undefined && <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded-full">{count}</span>}
  </button>
);

import { ConfirmationModal } from '../components/ConfirmationModal';

export const Tasks = () => {
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();
  const [filter, setFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useTasks(!!token, filter);
  const tasks = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  
  const retryMutation = useRetryTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  const handleRetry = async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      addMessage({ type: 'success', content: '任务已重新提交' });
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '重试失败' });
    }
  };

  const handleDeleteClick = (taskId: string) => {
    setDeleteId(taskId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      addMessage({ type: 'success', content: '任务已删除' });
      setDeleteId(null);
    } catch (err: any) {
      addMessage({ type: 'error', content: err.message || '删除失败' });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">任务中心</h1>
          <p className="text-gray-600 mt-1 text-sm">查看后台任务进度与结果回填</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? '刷新中...' : '刷新'}</span>
          </button>
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
          >
            <span>返回仪表盘</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <FilterTab label="全部任务" value="all" current={filter} onClick={setFilter} />
        <FilterTab label="进行中" value="processing" current={filter} onClick={setFilter} />
        <FilterTab label="已完成" value="completed" current={filter} onClick={setFilter} />
        <FilterTab label="失败" value="failed" current={filter} onClick={setFilter} />
        <FilterTab label="排队中" value="pending" current={filter} onClick={setFilter} />
      </div>

      {error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border border-red-100">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>加载任务失败: {(error as Error).message}</p>
          <button onClick={() => refetch()} className="mt-4 text-blue-600 hover:underline">重试</button>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && !isFetching && (
            <div className="p-12 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>加载中...</p>
            </div>
          )}

          {!isLoading && tasks.length === 0 && (
            <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>暂无任务</p>
            </div>
          )}

          {!isLoading && tasks.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
              {tasks.map((t) => {
                const graphId = t.payload?.graph_id;
                const nodeId = t.payload?.node_id;
                const resultTitles = Array.isArray(t.result?.nodeTitles) ? t.result.nodeTitles : [];
                const showResult = t.status === 'completed' && (t.type === 'expand_graph' || t.type === 'generate_questions');

                return (
                  <div key={t.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(t.status)}`}>
                            {getStatusIcon(t.status)}
                            <span>{t.status}</span>
                          </span>
                          <span className="font-semibold text-gray-900">{getTypeLabel(t.type)}</span>
                          <span className="text-xs text-gray-400 font-mono">#{t.id.slice(0, 8)}</span>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1.5 pl-1">
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                             <span className="flex items-center gap-1"><Clock size={12}/> 创建: {formatTime(t.created_at)}</span>
                             {t.updated_at !== t.created_at && <span>更新: {formatTime(t.updated_at)}</span>}
                          </div>
                          
                          {t.error && (
                             <div className="text-red-600 bg-red-50 p-2 rounded text-xs break-words border border-red-100">
                               <strong>错误：</strong>{t.error}
                             </div>
                          )}
                          
                          {showResult && t.type === 'expand_graph' && resultTitles.length > 0 && (
                            <div className="text-emerald-700 bg-emerald-50/50 p-2 rounded text-xs border border-emerald-100/50">
                              <span className="font-medium">新增节点：</span>
                              {resultTitles.slice(0, 6).join('、')}
                              {resultTitles.length > 6 ? ` 等 ${resultTitles.length} 个` : ''}
                            </div>
                          )}
                          
                          {showResult && t.type === 'generate_questions' && typeof t.result?.count === 'number' && (
                            <div className="text-emerald-700 bg-emerald-50/50 p-2 rounded text-xs border border-emerald-100/50">
                              <span className="font-medium">已生成卡片：</span> {t.result.count} 张
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {t.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(t.id)}
                              disabled={retryMutation.isPending}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="重试任务"
                            >
                              <RotateCw size={18} className={retryMutation.isPending ? "animate-spin" : ""} />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDeleteClick(t.id)}
                            disabled={deleteMutation.isPending}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="删除任务"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        {graphId && (
                          <button
                            onClick={() => navigate(`/graph/${graphId}`)}
                            className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                          >
                            打开图谱
                          </button>
                        )}
                        
                        {t.type === 'generate_questions' && nodeId && (
                          <button
                            onClick={() => navigate(`/study?node_id=${encodeURIComponent(nodeId)}`)}
                            className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            复习题目
                          </button>
                        )}
                        
                        {t.status === 'completed' && graphId && t.type === 'expand_graph' && (
                          <button
                            onClick={() => {
                              navigate(`/graph/${graphId}`);
                              addMessage({ type: 'info', content: '已打开图谱：如未自动刷新，请稍等或手动刷新页面' });
                            }}
                            className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"
                          >
                            查看结果
                          </button>
                        )}
                        
                        {t.status === 'completed' && t.type === 'generate_questions' && nodeId && (
                          <button
                            onClick={() => {
                              navigate(`/study?node_id=${encodeURIComponent(nodeId)}`);
                              addMessage({ type: 'success', content: '进入学习模式：可开始复习生成的题目' });
                            }}
                            className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"
                          >
                            开始学习
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="删除任务"
        message="确定要删除这个任务吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        isDangerous={true}
      />
    </div>
  );
};