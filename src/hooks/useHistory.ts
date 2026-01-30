import { useState, useCallback } from 'react';
import { Node } from '../types';

export type HistoryAction = 
  | { type: 'CREATE_NODE'; payload: Node }
  | { type: 'UPDATE_NODE'; payload: { id: string; before: Partial<Node>; after: Partial<Node> } };

interface UseHistoryProps {
  createNode: (data: any) => Promise<any>;
  updateNode: (params: { id: string; data: any; graphId: string }) => Promise<any>;
  deleteNode: (params: { id: string; graphId: string }) => Promise<any>;
}

export const useHistory = ({ createNode, updateNode, deleteNode }: UseHistoryProps) => {
  const [past, setPast] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);

  const record = useCallback((action: HistoryAction) => {
    setPast((prev) => [...prev, action]);
    setFuture([]);
  }, []);

  const undo = useCallback(async () => {
    let actionToUndo: HistoryAction | undefined;

    setPast((prev) => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      actionToUndo = newPast.pop();
      return newPast;
    });

    if (!actionToUndo) return;

    try {
      switch (actionToUndo.type) {
        case 'CREATE_NODE':
          // Undo Create -> Delete
          await deleteNode({ id: actionToUndo.payload.id, graphId: actionToUndo.payload.graph_id });
          break;
        case 'UPDATE_NODE':
          // Undo Update -> Revert to 'before'
          await updateNode({ 
            id: actionToUndo.payload.id, 
            data: actionToUndo.payload.before, 
            graphId: (actionToUndo.payload.before as any).graph_id || (actionToUndo.payload.after as any).graph_id 
          });
          break;
      }
      
      setFuture((prev) => [...prev, actionToUndo!]);
    } catch (error) {
      console.error('Undo failed:', error);
      // If failed, maybe put it back to past?
      setPast((prev) => [...prev, actionToUndo!]);
    }
  }, [createNode, updateNode, deleteNode]);

  const redo = useCallback(async () => {
    let actionToRedo: HistoryAction | undefined;

    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      actionToRedo = newFuture.pop();
      return newFuture;
    });

    if (!actionToRedo) return;

    try {
      switch (actionToRedo.type) {
        case 'CREATE_NODE':
          // Redo Create -> Create again (with same ID)
          await createNode(actionToRedo.payload);
          break;
        case 'UPDATE_NODE':
          // Redo Update -> Apply 'after'
          await updateNode({ 
            id: actionToRedo.payload.id, 
            data: actionToRedo.payload.after, 
            graphId: (actionToRedo.payload.after as any).graph_id || (actionToRedo.payload.before as any).graph_id 
          });
          break;
      }

      setPast((prev) => [...prev, actionToRedo!]);
    } catch (error) {
      console.error('Redo failed:', error);
      setFuture((prev) => [...prev, actionToRedo!]);
    }
  }, [createNode, updateNode, deleteNode]);

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
