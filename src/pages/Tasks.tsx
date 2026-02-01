import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, ArrowRight } from 'lucide-react';

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

export const Tasks = () => {
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();

  const { data, isLoading, error, refetch, isFetching } = useTasks(!!token);
  const tasks = useMemo(() => (Array.isArray(data) ? data : []), [data]);

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
            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>刷新</span>
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

      {isLoading && (
        <div className="bg-white rounded-lg shadow p-6 text-gray-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>加载任务中...</span>
        </div>
      )}

      {error && (
        <div className="bg-white rounded-lg shadow p-6 text-red-600">
          加载失败：{(error as Error).message || '未知错误'}
        </div>
      )}

      {!isLoading && !error && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-6 text-gray-600">暂无任务记录</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {tasks.map((t: any) => {
                const graphId = t.payload?.graph_id;
                const nodeId = t.payload?.node_id;
                const resultTitles = Array.isArray(t.result?.nodeTitles) ? t.result.nodeTitles : [];
                const showResult = t.status === 'completed' && (t.type === 'expand_graph' || t.type === 'generate_questions');

                return (
                  <div key={t.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(t.status)}`}>
                            {getStatusIcon(t.status)}
                            <span>{t.status}</span>
                          </span>
                          <span className="font-semibold text-gray-900">{getTypeLabel(t.type)}</span>
                        </div>

                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          <div>创建时间：{formatTime(t.created_at)}</div>
                          <div>更新时间：{formatTime(t.updated_at)}</div>
                          {t.error && <div className="text-red-600 break-words">错误：{t.error}</div>}
                          {showResult && t.type === 'expand_graph' && resultTitles.length > 0 && (
                            <div className="text-gray-700">
                              新增节点：{resultTitles.slice(0, 6).join('、')}
                              {resultTitles.length > 6 ? ` 等 ${resultTitles.length} 个` : ''}
                            </div>
                          )}
                          {showResult && t.type === 'generate_questions' && typeof t.result?.count === 'number' && (
                            <div className="text-gray-700">已生成卡片：{t.result.count} 张</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {graphId && (
                          <button
                            onClick={() => navigate(`/graph/${graphId}`)}
                            className="px-3 py-1.5 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
                          >
                            打开图谱
                          </button>
                        )}
                        {t.type === 'generate_questions' && nodeId && (
                          <button
                            onClick={() => navigate(`/study?node_id=${encodeURIComponent(nodeId)}`)}
                            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                          >
                            开始复习
                          </button>
                        )}
                        {t.status === 'completed' && graphId && t.type === 'expand_graph' && (
                          <button
                            onClick={() => {
                              navigate(`/graph/${graphId}`);
                              addMessage({ type: 'info', content: '已打开图谱：如未自动刷新，请稍等或手动刷新页面' });
                            }}
                            className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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
                            className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            查看结果
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
    </div>
  );
};

