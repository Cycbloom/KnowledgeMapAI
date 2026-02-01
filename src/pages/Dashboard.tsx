import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGraphs, useCreateGraphMutation, useImportGraphMutation, useDeleteGraphMutation, useDashboardStats } from '../hooks/useQueries';
import { Plus, BookOpen, Upload, Trash2 } from 'lucide-react';
import { useMessageStore } from '../store/useMessageStore';
import { parseMarkdownToGraph } from '../utils/markdownParser';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { BlindSpotList } from '../components/BlindSpotList';
import { StatsOverview } from '../components/StatsOverview';

export const Dashboard = () => {
  const { data: graphsData, isLoading, error } = useGraphs();
  const { data: statsData } = useDashboardStats();
  const createGraphMutation = useCreateGraphMutation();
  const importGraphMutation = useImportGraphMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { addMessage } = useMessageStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: ''
  });

  const graphs = Array.isArray(graphsData) ? graphsData : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      setFormError(null);
      await createGraphMutation.mutateAsync({ 
        title: newTitle,
        description: newDescription 
      });
      setNewTitle('');
      setNewDescription('');
      setIsCreating(false);
      addMessage({ type: 'success', content: '创建成功!' });
    } catch (err: any) {
      console.error(err);
      addMessage({ type: 'error', content: err.message || '创建图谱失败' });
    }
  };

  const handleDeleteGraph = (id: string, title: string) => {
    setDeleteConfirm({ isOpen: true, id, title });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;

    deleteGraphMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        addMessage({ type: 'success', content: '图谱删除成功' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      },
      onError: (err: any) => {
        console.error(err);
        addMessage({ type: 'error', content: err.message || '删除失败' });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const toggleManageMode = () => {
    setIsManageMode(!isManageMode);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let importData;

        if (file.name.endsWith('.md')) {
          const parsed = parseMarkdownToGraph(content);
          importData = {
            graph_title: parsed.graph_title || file.name.replace('.md', ''),
            nodes: parsed.nodes,
            edges: parsed.edges
          };
        } else {
          // Assume JSON
          const data = JSON.parse(content);
          importData = {
            graph_title: data.graph?.title || data.graph_title || file.name.replace('.json', ''),
            nodes: data.nodes || [],
            edges: data.edges || []
          };
        }
        
        await importGraphMutation.mutateAsync(importData);
        addMessage({ content: '导入成功!', type: 'success' });
      } catch (err: any) {
        console.error(err);
        addMessage({ content: '导入失败: ' + (err.message || '格式错误'), type: 'error' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (isLoading) return <div className="p-8">加载中...</div>;
  if (error) return <div className="p-8 text-red-600">错误: {(error as Error).message || '加载图谱失败'}</div>;

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">我的知识图谱</h1>
        <div className="flex space-x-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,.md"
            className="hidden"
          />
          <button
            onClick={toggleManageMode}
            className={`px-4 py-2 rounded-md flex items-center space-x-2 transition-colors ${
              isManageMode 
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Trash2 size={20} />
            <span>{isManageMode ? '完成管理' : '管理图谱'}</span>
          </button>
          <button
            onClick={handleImportClick}
            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-gray-50"
            disabled={importGraphMutation.isPending}
          >
            <Upload size={20} />
            <span>{importGraphMutation.isPending ? '导入中...' : '导入'}</span>
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>新建图谱</span>
          </button>
        </div>
      </div>

      {/* Statistics Section */}
      {statsData && (
        <div className="mb-12 space-y-6 animate-fade-in-up">
          <ActivityHeatmap data={statsData.heatmap || []} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatsOverview data={statsData.distribution || []} />
            <BlindSpotList data={statsData.blindSpots || []} />
          </div>
        </div>
      )}

      {isCreating && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">创建新图谱</h3>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="图谱名称"
                className="w-full border p-2 rounded-md"
                autoFocus
              />
            </div>
            <div>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="图谱描述（可选）"
                className="w-full border p-2 rounded-md"
                rows={3}
              />
            </div>
            {formError && <div className="text-red-600 text-sm">{formError}</div>}
            <div className="flex gap-4">
              <button 
                type="submit" 
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                disabled={createGraphMutation.isPending}
              >
                {createGraphMutation.isPending ? '创建中...' : '创建'}
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {graphs.length === 0 && !isCreating ? (
          <div className="col-span-full text-center text-gray-500 py-12">
            暂无图谱。创建一个开始吧！
          </div>
        ) : (
          graphs.map((graph, index) => (
            <div key={graph.id || index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100 group relative">
              {isManageMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDeleteGraph(graph.id, graph.title);
                  }}
                  className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors p-2 bg-red-50 rounded-full z-10"
                  title="删除图谱"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <h3 className="text-xl font-bold mb-2 text-gray-800 pr-8">{graph.title}</h3>
              <p className="text-gray-500 text-sm mb-4">创建时间: {new Date(graph.created_at).toLocaleDateString()}</p>
              <div className="flex justify-between items-center">
                <Link
                  to={`/graph/${graph.id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  打开图谱
                </Link>
                <Link
                  to={`/study?graph_id=${graph.id}`}
                  className="text-gray-600 hover:text-gray-800 flex items-center space-x-1 text-sm"
                >
                  <BookOpen size={16} />
                  <span>Study</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title="删除图谱"
        message={`确定要删除图谱 "${deleteConfirm.title}" 吗？此操作无法撤销，所有相关数据都将被永久删除。`}
        confirmText="删除"
        cancelText="取消"
        isDangerous={true}
      />
    </div>
  );
};
