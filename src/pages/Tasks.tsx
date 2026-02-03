import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTasks, useRetryTaskMutation, useDeleteTaskMutation } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, ArrowRight, Trash2, RotateCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

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
    case 'batch_generate_questions':
      return '批量生成题目';
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


export const Tasks = () => {
  const navigate = useNavigate();
  const { token } = useStore();
  const { addMessage } = useMessageStore();
  const [filter, setFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error, refetch, isFetching } = useTasks(!!token, filter, limit, (page - 1) * limit);
  const retryMutation = useRetryTaskMutation();
  const deleteMutation = useDeleteTaskMutation();
  const { tasks, total } = useMemo(() => {
    if (data && typeof data === 'object' && 'tasks' in data) {
      return { 
        tasks: Array.isArray(data.tasks) ? data.tasks : [], 
        total: typeof data.total === 'number' ? data.total : 0 
      };
    }
    return { tasks: [], total: 0 };
  }, [data]);
  
  const totalPages = Math.ceil(total / limit);

  const handleFilterChange = (v: string) => {
    setFilter(v);
    setPage(1);
  };

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

  const handleExport = () => {
    if (!tasks || tasks.length === 0) {
      addMessage({ type: 'warning', content: '暂无任务可导出' });
      return;
    }
    
    // Add BOM for Excel compatibility with UTF-8
    const BOM = "\uFEFF";
    const header = "ID,Name,Type,Status,Created At,Updated At,Error\n";
    const rows = tasks.map(t => {
      const name = t.name || getTypeLabel(t.type);
      // Escape quotes by doubling them
      const escapedName = name ? name.replace(/"/g, '""') : '';
      const error = t.error ? t.error.replace(/"/g, '""') : '';
      
      return `${t.id},"${escapedName}",${t.type},${t.status},${t.created_at},${t.updated_at},"${error}"`;
    }).join("\n");
    
    const csvContent = BOM + header + rows;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tasks_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addMessage({ type: 'success', content: '任务列表已导出' });
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">任务中心</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">查看后台任务进度与结果回填</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title="导出为 CSV"
          >
            <Download className="w-4 h-4" />
            <span>导出</span>
          </button>
          <button
            onClick={() => refetch()}
            className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? '刷新中...' : '刷新'}</span>
          </button>
          <Link
            to="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <span>返回仪表盘</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-x-auto">
        <FilterTab label="全部任务" value="all" current={filter} onClick={handleFilterChange} />
        <FilterTab label="进行中" value="processing" current={filter} onClick={handleFilterChange} />
        <FilterTab label="已完成" value="completed" current={filter} onClick={handleFilterChange} />
        <FilterTab label="失败" value="failed" current={filter} onClick={handleFilterChange} />
        <FilterTab label="排队中" value="pending" current={filter} onClick={handleFilterChange} />
      </div>

      {error ? (
        <div className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <XCircle className="w-8 h-8 mx-auto mb-2" />
          <p>加载任务失败: {(error as Error).message}</p>
          <button onClick={() => refetch()} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">重试</button>
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && !isFetching && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>加载中...</p>
            </div>
          )}

          {!isLoading && tasks.length === 0 && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
              <p>暂无任务</p>
            </div>
          )}

          {!isLoading && tasks.length > 0 && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                {tasks.map((t) => {
                  const graphId = t.payload?.graph_id;
                  const nodeId = t.payload?.node_id;
                  const resultTitles = Array.isArray(t.result?.nodeTitles) ? t.result.nodeTitles : [];
                  const showResult = t.status === 'completed' && (t.type === 'expand_graph' || t.type === 'generate_questions' || t.type === 'batch_generate_questions');

                  return (
                    <div key={t.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getStatusBadgeClass(t.status)}`}>
                              {getStatusIcon(t.status)}
                              <span>{t.status}</span>
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{t.name || getTypeLabel(t.type)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">#{t.id.slice(0, 8)}</span>
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 pl-1">
                            {t.status === 'processing' && t.result?.progress !== undefined && (
                              <div className="mt-2 w-full max-w-md bg-slate-100 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                                  <span className="flex items-center gap-2">
                                    <Loader2 size={12} className="animate-spin text-blue-500" />
                                    正在处理: <span className="text-blue-600 dark:text-blue-400">{t.result.current_node || '准备中...'}</span>
                                  </span>
                                  <span>{t.result.progress}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden shadow-inner">
                                  <div 
                                    className="bg-blue-500 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                                    style={{ width: `${t.result.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                               <span className="flex items-center gap-1"><Clock size={12}/> 创建: {formatTime(t.created_at)}</span>
                               {t.updated_at !== t.created_at && <span>更新: {formatTime(t.updated_at)}</span>}
                            </div>
                            
                            {t.error && (
                               <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded text-xs break-words border border-red-100 dark:border-red-900/20">
                                 <strong>错误：</strong>{t.error}
                               </div>
                            )}
                            
                            {showResult && t.type === 'expand_graph' && resultTitles.length > 0 && (
                              <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                <span className="font-medium">新增节点：</span>
                                {resultTitles.slice(0, 6).join('、')}
                                {resultTitles.length > 6 ? ` 等 ${resultTitles.length} 个` : ''}
                              </div>
                            )}
                            
                            {showResult && t.type === 'generate_questions' && typeof t.result?.count === 'number' && (
                              <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                <span className="font-medium">已生成卡片：</span> {t.result.count} 张
                              </div>
                            )}

                            {showResult && t.type === 'batch_generate_questions' && typeof t.result?.totalCards === 'number' && (
                              <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded text-xs border border-emerald-100/50 dark:border-emerald-900/20">
                                <span className="font-medium">批量生成完成：</span> 共生成 {t.result.totalCards} 张卡片
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
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                title="重试任务"
                              >
                                <RotateCw size={18} className={retryMutation.isPending ? "animate-spin" : ""} />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleDeleteClick(t.id)}
                              disabled={deleteMutation.isPending}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title="删除任务"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          {graphId && (
                            <button
                              onClick={() => navigate(`/graph/${graphId}`)}
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                            >
                              打开图谱
                            </button>
                          )}
                          
                          {t.type === 'generate_questions' && nodeId && (
                            <button
                              onClick={() => navigate(`/study?node_id=${encodeURIComponent(nodeId)}`)}
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
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
                              className="w-full px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none transition-colors"
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

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    显示 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .map((p, i, arr) => (
                          <React.Fragment key={p}>
                            {i > 0 && arr[i-1] !== p - 1 && <span className="text-gray-400">...</span>}
                            <button
                              onClick={() => setPage(p)}
                              className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                                page === p
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-md border border-gray-300 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </>
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