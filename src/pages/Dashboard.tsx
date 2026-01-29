import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Graph } from '../types';
import { Plus, BookOpen } from 'lucide-react';

export const Dashboard = () => {
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGraphs();
  }, []);

  const loadGraphs = async () => {
    try {
      const data = await api.graphs.list();
      setGraphs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const newGraph = await api.graphs.create({ title: newTitle });
      setGraphs([newGraph, ...graphs]);
      setNewTitle('');
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8">加载中...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">我的知识图谱</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          <span>新建图谱</span>
        </button>
      </div>

      {isCreating && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">创建新图谱</h3>
          <form onSubmit={handleCreate} className="flex gap-4">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="图谱名称"
              className="flex-1 border p-2 rounded-md"
              autoFocus
            />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
              创建
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              取消
            </button>
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
            <div key={graph.id || index} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-100">
              <h3 className="text-xl font-bold mb-2 text-gray-800">{graph.title}</h3>
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
    </div>
  );
};
