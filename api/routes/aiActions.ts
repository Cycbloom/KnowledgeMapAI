
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../supabase';
import { aiActionService } from '../services/ai/aiActionService';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = express.Router();

// List Actions
router.get('/', requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const graphId = req.query.graph_id as string;
  
  const actions = await aiActionService.listActions(supabaseAdmin, userId, graphId);
  res.json(actions);
});

// Create Action
router.post('/', requireAuth, async (req, res) => {
  const action = req.body;
  const userId = (req as any).user.id;
  
  // Enforce user ownership if scope is user/graph
  if (action.scope === 'user') {
      action.user_id = userId;
  } else if (action.scope === 'graph') {
      // Verify graph ownership
    if (!action.graph_id) throw new AppError('Graph ID required for graph scope', 400, ErrorCodes.VALIDATION_ERROR);
    
    // Check if user owns graph
    const { data: graph, error } = await supabaseAdmin
      .from('graphs')
      .select('user_id')
      .eq('id', action.graph_id)
      .single();

    if (error || !graph) {
      throw new AppError('Graph not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (graph.user_id !== userId) {
      throw new AppError('Not authorized to create action for this graph', 403, ErrorCodes.FORBIDDEN);
    }

    action.user_id = userId; // Assign creator
  } else if (action.scope === 'system') {
      // Only admin can create system actions (Skip check for now or assume backend protection)
  }

  const newAction = await aiActionService.createAction(supabaseAdmin, action);
  res.status(201).json(newAction);
});

// Update Action
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = (req as any).user.id;
  
  // Check ownership
  const existing = await aiActionService.getAction(supabaseAdmin, id);
  if (!existing) throw new AppError('Action not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  
  if (existing.scope !== 'system' && existing.user_id !== userId) {
      throw new AppError('Not authorized to update this action', 403, ErrorCodes.FORBIDDEN);
  }

  const updated = await aiActionService.updateAction(supabaseAdmin, id, updates);
  res.json(updated);
});

// Delete Action
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).user.id;
  
  // Check ownership
  const existing = await aiActionService.getAction(supabaseAdmin, id);
  if (!existing) throw new AppError('Action not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  
  if (existing.scope !== 'system' && existing.user_id !== userId) {
      throw new AppError('Not authorized to delete this action', 403, ErrorCodes.FORBIDDEN);
  }

  await aiActionService.deleteAction(supabaseAdmin, id);
  res.json({ success: true });
});

// Execute Action
router.post('/execute', requireAuth, async (req, res) => {
  const { action_id, node_id, graph_id } = req.body;
  const userId = (req as any).user.id;
  
  if (!action_id || !node_id) {
      throw new AppError('action_id and node_id are required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const result = await aiActionService.executeAction(
    action_id, 
    node_id, 
    userId, 
    graph_id || 'none'
  );
  
  res.json(result);
});

export default router;
