import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

const shareGraphSchema = z.object({
  graph_id: z.string().uuid(),
  permission: z.enum(['view', 'edit', 'admin']).default('view'),
  expires_at: z.string().optional(),
  max_users: z.number().min(1).max(100).optional(),
});

const addCollaboratorSchema = z.object({
  graph_id: z.string().uuid(),
  user_id: z.string().uuid(),
  permission: z.enum(['view', 'edit', 'admin']),
});

const updatePermissionSchema = z.object({
  graph_id: z.string().uuid(),
  user_id: z.string().uuid(),
  permission: z.enum(['view', 'edit', 'admin']),
});

router.post('/share', requireAuth, validate(shareGraphSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, permission, expires_at, max_users } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: graph, error: graphError } = await supabase
      .from('graphs')
      .select('user_id')
      .eq('id', graph_id)
      .single();

    if (graphError || !graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    if (graph.user_id !== req.user.id) {
      throw new AppError('只有图谱所有者可以分享', 403, ErrorCodes.FORBIDDEN);
    }

    const shareCode = generateShareCode();

    const { data: shareLink, error: shareError } = await supabase
      .from('graph_shares')
      .insert({
        graph_id,
        owner_id: req.user.id,
        share_code: shareCode,
        permission,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        max_users: max_users || null,
        current_users: 0
      })
      .select()
      .single();

    if (shareError) throw new AppError(shareError.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({
      success: true,
      share_link: {
        id: shareLink.id,
        share_code: shareCode,
        share_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/collab/${shareCode}`,
        permission,
        expires_at: shareLink.expires_at
      }
    });

  } catch (error: any) {
    logger.error('Share Graph Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '分享失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/join/:shareCode', requireAuth, async (req: AuthRequest, res: Response) => {
  const { shareCode } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: share, error: shareError } = await supabase
      .from('graph_shares')
      .select(`
        id,
        graph_id,
        owner_id,
        permission,
        expires_at,
        max_users,
        current_users,
        graphs(id, title, description)
      `)
      .eq('share_code', shareCode)
      .single();

    if (shareError || !share) {
      throw new AppError('分享链接无效或已过期', 404, ErrorCodes.NOT_FOUND);
    }

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new AppError('分享链接已过期', 410, ErrorCodes.VALIDATION_ERROR);
    }

    if (share.max_users && share.current_users >= share.max_users) {
      throw new AppError('分享链接已达到最大使用人数', 403, ErrorCodes.FORBIDDEN);
    }

    const { data: existingCollab } = await supabase
      .from('graph_collaborators')
      .select('id')
      .eq('graph_id', share.graph_id)
      .eq('user_id', req.user.id)
      .single();

    if (existingCollab) {
      return res.json({
        success: true,
        graph: share.graphs,
        permission: share.permission,
        already_joined: true
      });
    }

    const { error: collabError } = await supabase
      .from('graph_collaborators')
      .insert({
        graph_id: share.graph_id,
        user_id: req.user.id,
        permission: share.permission,
        joined_at: new Date().toISOString()
      });

    if (collabError) throw new AppError(collabError.message, 500, ErrorCodes.INTERNAL_ERROR);

    await supabase
      .from('graph_shares')
      .update({ current_users: share.current_users + 1 })
      .eq('id', share.id);

    res.json({
      success: true,
      graph: share.graphs,
      permission: share.permission,
      already_joined: false
    });

  } catch (error: any) {
    logger.error('Join Graph Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '加入失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/collaborators/:graphId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: graph } = await supabase
      .from('graphs')
      .select('user_id')
      .eq('id', graphId)
      .single();

    if (!graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const isOwner = graph.user_id === req.user.id;
    
    const { data: collaborator } = await supabase
      .from('graph_collaborators')
      .select('permission')
      .eq('graph_id', graphId)
      .eq('user_id', req.user.id)
      .single();

    if (!isOwner && !collaborator) {
      throw new AppError('无权访问此图谱', 403, ErrorCodes.FORBIDDEN);
    }

    const { data: collaborators, error } = await supabase
      .from('graph_collaborators')
      .select(`
        user_id,
        permission,
        joined_at,
        profiles(id, username, avatar_url)
      `)
      .eq('graph_id', graphId);

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    const { data: owner } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('id', graph.user_id)
      .single();

    res.json({
      owner,
      collaborators: collaborators || [],
      my_permission: isOwner ? 'admin' : collaborator?.permission
    });

  } catch (error: any) {
    logger.error('Get Collaborators Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '获取协作者失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/add-collaborator', requireAuth, validate(addCollaboratorSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, user_id, permission } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: graph } = await supabase
      .from('graphs')
      .select('user_id')
      .eq('id', graph_id)
      .single();

    if (!graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    if (graph.user_id !== req.user.id) {
      const { data: myCollab } = await supabase
        .from('graph_collaborators')
        .select('permission')
        .eq('graph_id', graph_id)
        .eq('user_id', req.user.id)
        .single();

      if (!myCollab || myCollab.permission !== 'admin') {
        throw new AppError('只有管理员可以添加协作者', 403, ErrorCodes.FORBIDDEN);
      }
    }

    const { data: existingCollab } = await supabase
      .from('graph_collaborators')
      .select('id')
      .eq('graph_id', graph_id)
      .eq('user_id', user_id)
      .single();

    if (existingCollab) {
      throw new AppError('该用户已是协作者', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { error } = await supabase
      .from('graph_collaborators')
      .insert({
        graph_id,
        user_id,
        permission,
        joined_at: new Date().toISOString()
      });

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ success: true });

  } catch (error: any) {
    logger.error('Add Collaborator Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '添加协作者失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.delete('/remove-collaborator', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id, user_id } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: graph } = await supabase
      .from('graphs')
      .select('user_id')
      .eq('id', graph_id)
      .single();

    if (!graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    if (graph.user_id !== req.user.id) {
      const { data: myCollab } = await supabase
        .from('graph_collaborators')
        .select('permission')
        .eq('graph_id', graph_id)
        .eq('user_id', req.user.id)
        .single();

      if (!myCollab || myCollab.permission !== 'admin') {
        throw new AppError('只有管理员可以移除协作者', 403, ErrorCodes.FORBIDDEN);
      }
    }

    const { error } = await supabase
      .from('graph_collaborators')
      .delete()
      .eq('graph_id', graph_id)
      .eq('user_id', user_id);

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ success: true });

  } catch (error: any) {
    logger.error('Remove Collaborator Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '移除协作者失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.put('/update-permission', requireAuth, validate(updatePermissionSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, user_id, permission } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: graph } = await supabase
      .from('graphs')
      .select('user_id')
      .eq('id', graph_id)
      .single();

    if (!graph) {
      throw new AppError('图谱不存在', 404, ErrorCodes.NOT_FOUND);
    }

    if (graph.user_id !== req.user.id) {
      const { data: myCollab } = await supabase
        .from('graph_collaborators')
        .select('permission')
        .eq('graph_id', graph_id)
        .eq('user_id', req.user.id)
        .single();

      if (!myCollab || myCollab.permission !== 'admin') {
        throw new AppError('只有管理员可以修改权限', 403, ErrorCodes.FORBIDDEN);
      }
    }

    const { error } = await supabase
      .from('graph_collaborators')
      .update({ permission })
      .eq('graph_id', graph_id)
      .eq('user_id', user_id);

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ success: true });

  } catch (error: any) {
    logger.error('Update Permission Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '更新权限失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/my-collaborations', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: collaborations, error } = await supabase
      .from('graph_collaborators')
      .select(`
        permission,
        joined_at,
        graphs(id, title, description, updated_at, profiles(id, username, avatar_url))
      `)
      .eq('user_id', req.user.id)
      .order('joined_at', { ascending: false });

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ collaborations: collaborations || [] });

  } catch (error: any) {
    logger.error('Get My Collaborations Error:', error);
    throw new AppError(error.message || '获取协作列表失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default router;
