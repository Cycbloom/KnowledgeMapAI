import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { Graph3D } from '../components/Graph3D';
import { Node } from '../types';
import { Save, Plus, Wand2, Download, Trash2 } from 'lucide-react';

export const GraphEditor = () => {
  const { id } = useParams<{ id: string }>();
  const { nodes, edges, setNodes, setEdges, addNode, updateNode, removeNode, addEdge, removeEdge } = useStore();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphTitle, setGraphTitle] = useState('');

  useEffect(() => {
    if (id) loadGraph(id);
  }, [id]);

  const loadGraph = async (graphId: string) => {
    try {
      setLoading(true);
      const graph = await api.graphs.get(graphId);
      setGraphTitle(graph.title);
      const data = await api.graphs.getNodes(graphId);
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNode = async () => {
    if (!id) return;
    const newNode = {
      graph_id: id,
      title: 'New Node',
      content: '',
      x_position: (Math.random() - 0.5) * 20,
      y_position: (Math.random() - 0.5) * 20,
      color: '#3B82F6'
    };
    try {
      const created = await api.nodes.create(newNode);
      addNode(created);
      setSelectedNode(created);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNode = async (updates: Partial<Node>) => {
    if (!selectedNode) return;
    try {
      const updated = await api.nodes.update(selectedNode.id, updates);
      updateNode(selectedNode.id, updated);
      setSelectedNode(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (!confirm('Are you sure you want to delete this node?')) return;
    try {
      await api.nodes.delete(selectedNode.id);
      removeNode(selectedNode.id);
      setSelectedNode(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIGenerate = async () => {
    if (!selectedNode) return;
    setLoading(true);
    try {
      const res = await api.ai.generate({ topic: selectedNode.title, context: aiPrompt });
      handleUpdateNode({ content: res.content });
      setAiPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAIExpand = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      const res = await api.ai.expand({ node_title: selectedNode.title });
      const suggestions = res.suggestions;
      
      // Create new nodes and edges
      for (const s of suggestions) {
        // Random position near parent
        const x = selectedNode.x_position + (Math.random() - 0.5) * 10;
        const y = selectedNode.y_position + (Math.random() - 0.5) * 10;
        
        const newNode = await api.nodes.create({
          graph_id: id,
          title: s.title,
          content: s.content,
          x_position: x,
          y_position: y,
          color: '#10B981'
        });
        addNode(newNode);
        
        const newEdge = await api.edges.create({
          source_node_id: selectedNode.id,
          target_node_id: newNode.id,
          relationship_type: 'related'
        });
        addEdge(newEdge);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {/* 3D Canvas */}
      <div className="flex-1 h-full">
        <Graph3D nodes={nodes} edges={edges} onNodeClick={setSelectedNode} />
      </div>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-md flex space-x-2">
        <h2 className="font-bold px-2 py-1">{graphTitle}</h2>
        <div className="w-px bg-gray-300 mx-2"></div>
        <button onClick={handleAddNode} className="p-1 hover:bg-gray-100 rounded" title="Add Node">
          <Plus size={20} />
        </button>
        <button className="p-1 hover:bg-gray-100 rounded" title="Export">
          <Download size={20} />
        </button>
      </div>

      {/* Sidebar */}
      {selectedNode && (
        <div className="w-80 bg-white shadow-lg border-l border-gray-200 p-4 overflow-y-auto absolute right-0 top-0 bottom-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Node Details</h3>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => handleUpdateNode({ title: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <input
                type="color"
                value={selectedNode.color}
                onChange={(e) => handleUpdateNode({ color: e.target.value })}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Content</label>
              <textarea
                value={selectedNode.content || ''}
                onChange={(e) => handleUpdateNode({ content: e.target.value })}
                rows={6}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-sm"
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-semibold mb-2 flex items-center">
                <Wand2 size={16} className="mr-2 text-purple-600" />
                AI Assistant
              </h4>
              <div className="space-y-2">
                <button
                  onClick={handleAIGenerate}
                  disabled={loading}
                  className="w-full bg-purple-100 text-purple-700 py-2 rounded-md hover:bg-purple-200 text-sm"
                >
                  {loading ? 'Generating...' : 'Generate Content'}
                </button>
                <button
                  onClick={handleAIExpand}
                  disabled={loading}
                  className="w-full bg-green-100 text-green-700 py-2 rounded-md hover:bg-green-200 text-sm"
                >
                  {loading ? 'Expanding...' : 'Expand Related Nodes'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleDeleteNode}
                className="w-full bg-red-50 text-red-600 py-2 rounded-md hover:bg-red-100 text-sm flex items-center justify-center"
              >
                <Trash2 size={16} className="mr-2" />
                Delete Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
