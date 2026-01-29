import { create } from 'zustand';
import { User, Graph, Node, Edge } from '../types';

interface AppState {
  user: User | null;
  token: string | null;
  currentGraph: Graph | null;
  nodes: Node[];
  edges: Edge[];
  setUser: (user: User | null, token: string | null) => void;
  setCurrentGraph: (graph: Graph | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  currentGraph: null,
  nodes: [],
  edges: [],
  setUser: (user, token) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    set({ user, token });
  },
  setCurrentGraph: (graph) => set({ currentGraph: graph }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
  })),
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
    edges: state.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
  })),
  addEdge: (edge) => set((state) => ({ edges: [...state.edges, edge] })),
  removeEdge: (id) => set((state) => ({ edges: state.edges.filter((e) => e.id !== id) })),
}));
