import { useState, useCallback } from 'react';
import { Node, Edge } from '../types';

export type HistoryAction = 
  | { type: 'CREATE_NODE'; payload: Node }
  | { type: 'DELETE_NODE'; payload: { node: Node; edges: Edge[] } }
  | { type: 'UPDATE_NODE'; payload: { id: string; before: Partial<Node>; after: Partial<Node> } }
  | { type: 'CREATE_EDGE'; payload: Edge }
  | { type: 'DELETE_EDGE'; payload: Edge }
  | { type: 'BATCH'; payload: HistoryAction[] };

interface UseHistoryProps {
  createNode: (data: any) => Promise<any>;
  updateNode: (params: { id: string; data: any; graphId: string }) => Promise<any>;
  deleteNode: (params: { id: string; graphId: string }) => Promise<any>;
  createEdge: (data: any) => Promise<any>;
  deleteEdge: (params: { id: string; graphId: string }) => Promise<any>;
}

export const useHistory = ({ createNode, updateNode, deleteNode, createEdge, deleteEdge }: UseHistoryProps) => {
  const [past, setPast] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);

  const record = useCallback((action: HistoryAction) => {
    setPast((prev) => [...prev, action]);
    setFuture([]);
  }, []);

  const executeUndo = useCallback(async (action: HistoryAction) => {
    switch (action.type) {
      case 'CREATE_NODE':
        // Undo Create -> Delete
        await deleteNode({ id: action.payload.id, graphId: action.payload.graph_id });
        break;
      case 'DELETE_NODE':
        // Undo Delete -> Create (Restore)
        await createNode(action.payload.node);
        // Restore edges
        if (action.payload.edges && action.payload.edges.length > 0) {
          await Promise.all(action.payload.edges.map(edge => createEdge(edge)));
        }
        break;
      case 'UPDATE_NODE':
        // Undo Update -> Revert to 'before'
        await updateNode({ 
          id: action.payload.id, 
          data: action.payload.before, 
          graphId: (action.payload.before as any).graph_id || (action.payload.after as any).graph_id 
        });
        break;
      case 'CREATE_EDGE':
        // Undo Create Edge -> Delete
        await deleteEdge({ id: action.payload.id, graphId: (action.payload as any).graph_id || '' });
        break;
      case 'DELETE_EDGE':
        // Undo Delete Edge -> Create (Restore)
        await createEdge(action.payload);
        break;
      case 'BATCH':
        // Undo Batch -> Undo each action in reverse order
        for (let i = action.payload.length - 1; i >= 0; i--) {
          await executeUndo(action.payload[i]);
        }
        break;
    }
  }, [createNode, updateNode, deleteNode, createEdge, deleteEdge]);

  const executeRedo = useCallback(async (action: HistoryAction) => {
    switch (action.type) {
      case 'CREATE_NODE':
        // Redo Create -> Create again
        await createNode(action.payload);
        break;
      case 'DELETE_NODE':
        // Redo Delete -> Delete again
        await deleteNode({ id: action.payload.node.id, graphId: action.payload.node.graph_id });
        break;
      case 'UPDATE_NODE':
        // Redo Update -> Apply 'after'
        await updateNode({ 
          id: action.payload.id, 
          data: action.payload.after, 
          graphId: (action.payload.after as any)?.graph_id || (action.payload.before as any)?.graph_id 
        });
        break;
      case 'CREATE_EDGE':
        // Redo Create Edge -> Create again
        await createEdge(action.payload);
        break;
      case 'DELETE_EDGE':
        // Redo Delete Edge -> Delete again
        await deleteEdge({ id: action.payload.id, graphId: (action.payload as any).graph_id || '' });
        break;
      case 'BATCH':
        // Redo Batch -> Redo each action in order
        for (const subAction of action.payload) {
          await executeRedo(subAction);
        }
        break;
    }
  }, [createNode, updateNode, deleteNode, createEdge, deleteEdge]);

  const undo = useCallback(async () => {
    if (past.length === 0) return;

    const actionToUndo = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    // Optimistic update
    setPast(newPast);

    try {
      await executeUndo(actionToUndo);
      setFuture((prev) => [...prev, actionToUndo]);
    } catch (error) {
      console.error('Undo failed:', error);
      // Revert state change if failed
      setPast((prev) => [...prev, actionToUndo]);
    }
  }, [past, executeUndo]);

  const redo = useCallback(async () => {
    if (future.length === 0) return;

    const actionToRedo = future[future.length - 1];
    const newFuture = future.slice(0, -1);

    // Optimistic update
    setFuture(newFuture);

    try {
      await executeRedo(actionToRedo);
      setPast((prev) => [...prev, actionToRedo]);
    } catch (error) {
      console.error('Redo failed:', error);
      // Revert state change if failed
      setFuture((prev) => [...prev, actionToRedo]);
    }
  }, [future, executeRedo]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return {
    undo,
    redo,
    record,
    canUndo,
    canRedo,
    past,
    future
  };
};
