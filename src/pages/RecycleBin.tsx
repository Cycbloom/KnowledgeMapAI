import { useState } from 'react';
import { useTrashGraphs, useRestoreGraphMutation, usePermanentDeleteGraphMutation } from '../hooks/useQueries';
import { Trash2, RefreshCw, Search, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useTheme } from '../hooks/useTheme';
import { useNavigate } from 'react-router-dom';

export const RecycleBin = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { data: trashData, isLoading, error } = useTrashGraphs();
  const restoreGraphMutation = useRestoreGraphMutation();
  const permanentDeleteGraphMutation = usePermanentDeleteGraphMutation();
  const { addMessage } = useMessageStore();

  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: ''
  });

  const graphs = Array.isArray(trashData) ? trashData : [];
  
  const filteredGraphs = graphs.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (g.description && g.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRestore = async (id: string) => {
    try {
      await restoreGraphMutation.mutateAsync(id);
      addMessage({ type: 'success', content: '图谱已恢复' });
    } catch (err: any) {
      console.error(err);
      addMessage({ type: 'error', content: err.message || '恢复失败' });
    }
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;

    permanentDeleteGraphMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        addMessage({ type: 'success', content: '图谱已永久删除' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      },
      onError: (err: any) => {
        console.error(err);
        addMessage({ type: 'error', content: err.message || '删除失败' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  if (isLoading) return <div className={`min-h-full flex items-center justify-center p-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>正在加载回收站...</div>;
  if (error) return <div className="p-8 text-red-600">错误: {(error as Error).message || '加载回收站失败'}</div>;

  return (
    <div className={`h-full overflow-y-auto custom-scrollbar transition-colors ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
                <button onClick={() => navigate(-1)} className={`p-1 rounded-full hover:bg-opacity-10 transition-colors ${isDark ? 'hover:bg-white' : 'hover:bg-black'}`}>
                    <ArrowLeft size={24} className={isDark ? 'text-slate-400' : 'text-gray-600'} />
                </button>
                <h1 className="text-3xl font-extrabold tracking-tight text-red-500">
                回收站
                </h1>
            </div>
            <p className={`${isDark ? 'text-slate-400' : 'text-gray-500'} text-lg max-w-xl`}>
              查看和管理已删除的图谱。您可以恢复它们，或永久删除。
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} size={18} />
              <input 
                type="text" 
                placeholder="搜索已删除图谱..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 pr-4 py-2.5 rounded-xl border outline-none transition-all w-full md:w-64 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white' 
                    : 'bg-white border-gray-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-sm'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Graphs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGraphs.length === 0 ? (
            <div className={`col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed ${
              isDark ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className={`p-6 rounded-full mb-4 ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-white text-gray-300'}`}>
                <Trash2 size={48} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-gray-900'}`}>
                {searchQuery ? '未找到相关图谱' : '回收站为空'}
              </h3>
              <p className={`text-center max-w-md ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                {searchQuery ? '尝试更换搜索关键词' : '最近删除的图谱将显示在这里。'}
              </p>
            </div>
          ) : (
            filteredGraphs.map((graph) => (
              <div 
                key={graph.id} 
                className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 hover:border-red-900/50' 
                    : 'bg-white border-gray-100 hover:border-red-100 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3.5 rounded-xl transition-colors ${
                    isDark 
                      ? 'bg-red-900/20 text-red-400' 
                      : 'bg-red-50 text-red-500'
                  }`}>
                    <Trash2 size={24} />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(graph.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark 
                          ? 'text-green-400 hover:bg-green-900/30' 
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title="恢复图谱"
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(graph.id, graph.title)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark 
                          ? 'text-red-400 hover:bg-red-900/30' 
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                      title="永久删除"
                    >
                      <AlertTriangle size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className={`text-xl font-bold mb-2 line-clamp-1 ${
                  isDark ? 'text-slate-100' : 'text-gray-900'
                }`}>
                  {graph.title}
                </h3>
                
                <p className={`text-sm line-clamp-2 mb-4 ${
                  isDark ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  {graph.description || '暂无描述'}
                </p>

                <div className={`pt-4 border-t text-xs ${isDark ? 'border-slate-700 text-slate-500' : 'border-gray-50 text-gray-400'}`}>
                    删除时间: {new Date(graph.deleted_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        <ConfirmationModal
          isOpen={deleteConfirm.isOpen}
          title="永久删除图谱"
          message={`确定要永久删除图谱 "${deleteConfirm.title}" 吗？此操作将无法撤销，所有数据将彻底丢失！`}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          isDangerous={true}
          confirmText="永久删除"
        />
      </div>
    </div>
  );
};
