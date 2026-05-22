import { useState, useCallback, useRef, useEffect } from 'react';
import { Node, Edge } from '../../types';

export type HistoryAction = 
  | { type: 'CREATE_NODE'; payload: Node }
  | { type: 'DELETE_NODE'; payload: { node: Node; edges: Edge[] } }
  | { type: 'UPDATE_NODE'; payload: { id: string; before: Partial<Node> & { graph_id?: string }; after: Partial<Node> & { graph_id?: string } } }
  | { type: 'CREATE_EDGE'; payload: Edge & { graph_id?: string } }
  | { type: 'DELETE_EDGE'; payload: Edge & { graph_id?: string } }
  | { type: 'BATCH'; payload: HistoryAction[] };

interface UseHistoryProps {
  createNode: (data: Partial<Node> & { graph_id: string }) => Promise<Node>;
  updateNode: (params: { id: string; data: Partial<Node>; graphId: string }) => Promise<Node>;
  deleteNode: (params: { id: string; graphId: string }) => Promise<void>;
  createEdge: (data: { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type?: string; graph_id: string }) => Promise<Edge>;
  deleteEdge: (params: { id: string; graphId: string }) => Promise<void>;
}

export const useHistory = ({ createNode, updateNode, deleteNode, createEdge, deleteEdge }: UseHistoryProps) => {
  const [past, setPast] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);

  const executeUndoRef = useRef<((action: HistoryAction) => Promise<void>) | null>(null);
  const executeRedoRef = useRef<((action: HistoryAction) => Promise<void>) | null>(null);

  const record = useCallback((action: HistoryAction) => {
    setPast((prev) => [...prev, action]);
    setFuture([]);
  }, []);

  const executeUndo = useCallback(async (action: HistoryAction) => {
    switch (action.type) {
      case 'CREATE_NODE':
        await deleteNode({ id: action.payload.id, graphId: action.payload.graph_id });
        break;
      case 'DELETE_NODE':
        await createNode(action.payload.node);
        if (action.payload.edges && action.payload.edges.length > 0) {
          await Promise.all(action.payload.edges.map(edge => createEdge(edge)));
        }
        break;
      case 'UPDATE_NODE':
        await updateNode({ 
          id: action.payload.id, 
          data: action.payload.before, 
          graphId: action.payload.before.graph_id || action.payload.after.graph_id || ''
        });
        break;
      case 'CREATE_EDGE':
        await deleteEdge({ id: action.payload.id, graphId: action.payload.graph_id || '' });
        break;
      case 'DELETE_EDGE':
        await createEdge(action.payload);
        break;
      case 'BATCH':
        for (let i = action.payload.length - 1; i >= 0; i--) {
          if (executeUndoRef.current) {
            await executeUndoRef.current(action.payload[i]);
          }
        }
        break;
    }
  }, [createNode, updateNode, deleteNode, createEdge, deleteEdge]);

  const executeRedo = useCallback(async (action: HistoryAction) => {
    switch (action.type) {
      case 'CREATE_NODE':
        await createNode(action.payload);
        break;
      case 'DELETE_NODE':
        await deleteNode({ id: action.payload.node.id, graphId: action.payload.node.graph_id });
        break;
      case 'UPDATE_NODE':
        await updateNode({ 
          id: action.payload.id, 
          data: action.payload.after, 
          graphId: action.payload.after.graph_id || action.payload.before.graph_id || ''
        });
        break;
      case 'CREATE_EDGE':
        await createEdge(action.payload);
        break;
      case 'DELETE_EDGE':
        await deleteEdge({ id: action.payload.id, graphId: action.payload.graph_id || '' });
        break;
      case 'BATCH':
        for (const subAction of action.payload) {
          if (executeRedoRef.current) {
            await executeRedoRef.current(subAction);
          }
        }
        break;
    }
  }, [createNode, updateNode, deleteNode, createEdge, deleteEdge]);

  useEffect(() => {
    executeUndoRef.current = executeUndo;
    executeRedoRef.current = executeRedo;
  }, [executeUndo, executeRedo]);

  const undo = useCallback(async () => {
    if (past.length === 0) return;

    const actionToUndo = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    setPast(newPast);

    try {
      await executeUndo(actionToUndo);
      setFuture((prev) => [...prev, actionToUndo]);
    } catch (error) {
      console.error('Undo failed:', error);
      setPast((prev) => [...prev, actionToUndo]);
    }
  }, [past, executeUndo]);

  const redo = useCallback(async () => {
    if (future.length === 0) return;

    const actionToRedo = future[future.length - 1];
    const newFuture = future.slice(0, -1);
    
    setFuture(newFuture);

    try {
      await executeRedo(actionToRedo);
      setPast((prev) => [...prev, actionToRedo]);
    } catch (error) {
      console.error('Redo failed:', error);
      setFuture((prev) => [...prev, actionToRedo]);
    }
  }, [future, executeRedo]);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    past,
    future,
    record,
    undo,
    redo,
    clear,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
};
