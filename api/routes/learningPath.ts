import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { graphService } from '../services/graphService.js';
import { getAIProviderForTask, getAIProvider } from '../services/ai/factory.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

const generatePathSchema = z.object({
  graph_id: z.string().uuid(),
  target_node_id: z.string().uuid().optional(),
  learning_style: z.enum(['sequential', 'exploratory', 'focused']).default('sequential'),
  daily_time_minutes: z.number().min(5).max(240).default(30),
  provider: z.string().optional(),
  model: z.string().optional(),
});

interface LearningProgress {
  nodeId: string;
  nodeTitle: string;
  masteryLevel: number;
  lastReviewDate: Date | null;
  nextReviewDate: Date | null;
  reviewCount: number;
  stability: number;
  difficulty: number;
}

interface LearningPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level: string;
  order: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedTime: number;
  prerequisites: string[];
  isCompleted: boolean;
  masteryLevel: number;
  nextReviewDate: string | null;
}

interface LearningPath {
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
}

router.post('/generate', requireAuth, validate(generatePathSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, target_node_id, learning_style, daily_time_minutes, provider: providerType, model } = req.body;
  const supabase = req.supabase!;

  try {
    const { nodes, edges } = await graphService.getGraphNodes(supabase, req.user.id, graph_id);
    
    if (nodes.length === 0) {
      throw new AppError('图谱中没有节点', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data: graphMeta } = await supabase
      .from('graphs')
      .select('title')
      .eq('id', graph_id)
      .single();

    const { data: cardProgress } = await supabase
      .from('card_progress')
      .select(`
        card_id,
        stability,
        difficulty,
        elapsed_days,
        scheduled_days,
        last_review,
        next_review,
        review_count,
        cards!inner(node_id)
      `)
      .eq('user_id', req.user.id);

    const progressMap = new Map<string, LearningProgress>();
    if (cardProgress) {
      cardProgress.forEach((p: any) => {
        const nodeId = p.cards?.node_id;
        if (nodeId) {
          const existing = progressMap.get(nodeId) || {
            nodeId,
            nodeTitle: '',
            masteryLevel: 0,
            lastReviewDate: null,
            nextReviewDate: null,
            reviewCount: 0,
            stability: 0,
            difficulty: 0
          };
          
          existing.reviewCount = Math.max(existing.reviewCount, p.review_count || 0);
          existing.stability = Math.max(existing.stability, p.stability || 0);
          existing.difficulty = p.difficulty || 0;
          
          if (p.last_review) {
            existing.lastReviewDate = new Date(p.last_review);
          }
          if (p.next_review) {
            existing.nextReviewDate = new Date(p.next_review);
          }
          
          const mastery = Math.min(1, (existing.stability / 30) * (1 - existing.difficulty / 10));
          existing.masteryLevel = mastery;
          
          progressMap.set(nodeId, existing);
        }
      });
    }

    nodes.forEach((node: any) => {
      if (!progressMap.has(node.id)) {
        progressMap.set(node.id, {
          nodeId: node.id,
          nodeTitle: node.title,
          masteryLevel: 0,
          lastReviewDate: null,
          nextReviewDate: null,
          reviewCount: 0,
          stability: 0,
          difficulty: 0
        });
      } else {
        const progress = progressMap.get(node.id)!;
        progress.nodeTitle = node.title;
      }
    });

    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();
    
    nodes.forEach((node: any) => {
      parentMap.set(node.id, []);
      childMap.set(node.id, []);
    });
    
    edges.forEach((edge: any) => {
      const parents = parentMap.get(edge.target_node_id) || [];
      parents.push(edge.source_node_id);
      parentMap.set(edge.target_node_id, parents);
      
      const children = childMap.get(edge.source_node_id) || [];
      children.push(edge.target_node_id);
      childMap.set(edge.source_node_id, children);
    });

    const sortedNodes: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    
    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) return;
      if (visited.has(nodeId)) return;
      
      temp.add(nodeId);
      
      const parents = parentMap.get(nodeId) || [];
      parents.forEach(parentId => visit(parentId));
      
      temp.delete(nodeId);
      visited.add(nodeId);
      sortedNodes.push(nodeId);
    };
    
    nodes.forEach((node: any) => visit(node.id));

    const today = new Date();
    const stages: LearningPathStage[] = [];
    let order = 0;

    for (const nodeId of sortedNodes) {
      const node = nodes.find((n: any) => n.id === nodeId);
      const progress = progressMap.get(nodeId);
      
      if (!node) continue;

      const parents = parentMap.get(nodeId) || [];
      const completedPrerequisites = parents.filter(pId => {
        const pProgress = progressMap.get(pId);
        return pProgress && pProgress.masteryLevel > 0.6;
      });

      let priority: 'high' | 'medium' | 'low' = 'medium';
      let reason = '';
      
      if (progress && progress.nextReviewDate && new Date(progress.nextReviewDate) <= today) {
        priority = 'high';
        reason = '需要复习：已到复习时间';
      } else if (!progress || progress.masteryLevel < 0.3) {
        priority = 'high';
        reason = '需要学习：尚未掌握';
      } else if (progress.masteryLevel < 0.6) {
        priority = 'medium';
        reason = '需要巩固：掌握程度较低';
      } else if (progress.masteryLevel < 0.8) {
        priority = 'low';
        reason = '可选复习：基本掌握';
      } else {
        priority = 'low';
        reason = '已掌握：可跳过';
      }

      if (target_node_id) {
        const pathToTarget = findPath(nodeId, target_node_id, childMap);
        if (pathToTarget.length > 0) {
          priority = 'high';
          reason = '目标路径上的知识点';
        }
      }

      const estimatedTime = Math.max(5, Math.round(15 - progress.masteryLevel * 10));

      stages.push({
        nodeId,
        nodeTitle: node.title,
        nodeContent: node.content || '',
        level: node.level || 'normal',
        order: order++,
        priority,
        reason,
        estimatedTime,
        prerequisites: parents,
        isCompleted: progress.masteryLevel > 0.8,
        masteryLevel: progress.masteryLevel,
        nextReviewDate: progress.nextReviewDate?.toISOString() || null
      });
    }

    stages.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.order - b.order;
    });

    const todayPlan: LearningPathStage[] = [];
    let remainingTime = daily_time_minutes;
    
    for (const stage of stages) {
      if (remainingTime <= 0) break;
      if (stage.isCompleted && stage.priority !== 'high') continue;
      
      todayPlan.push(stage);
      remainingTime -= stage.estimatedTime;
    }

    const totalEstimatedTime = stages.reduce((sum, s) => sum + s.estimatedTime, 0);
    const completedCount = stages.filter(s => s.isCompleted).length;
    const estimatedDays = Math.ceil(totalEstimatedTime / daily_time_minutes);
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + estimatedDays);

    const weeklyProgress: number[] = [];
    let accumulatedTime = 0;
    for (let i = 0; i < 7; i++) {
      accumulatedTime += daily_time_minutes;
      const progress = Math.min(100, (accumulatedTime / totalEstimatedTime) * 100);
      weeklyProgress.push(Math.round(progress));
    }

    const suggestions: string[] = [];
    const highPriorityCount = stages.filter(s => s.priority === 'high' && !s.isCompleted).length;
    if (highPriorityCount > 5) {
      suggestions.push('建议增加每日学习时间，有较多待学习/复习的知识点');
    }
    
    const lowMasteryNodes = stages.filter(s => s.masteryLevel < 0.3 && !s.isCompleted);
    if (lowMasteryNodes.length > 0) {
      suggestions.push(`建议优先学习：${lowMasteryNodes.slice(0, 3).map(n => n.nodeTitle).join('、')}`);
    }

    const dueReviews = stages.filter(s => s.nextReviewDate && new Date(s.nextReviewDate) <= today);
    if (dueReviews.length > 0) {
      suggestions.push(`有 ${dueReviews.length} 个知识点需要复习`);
    }

    const learningPath: LearningPath = {
      graphId: graph_id,
      graphTitle: graphMeta?.title || '未命名图谱',
      totalNodes: nodes.length,
      completedNodes: completedCount,
      estimatedTotalTime: totalEstimatedTime,
      stages,
      todayPlan,
      predictions: {
        completionDate: completionDate.toISOString(),
        weeklyProgress,
        recommendedDailyTime: Math.min(60, Math.ceil(totalEstimatedTime / 14))
      },
      suggestions
    };

    res.json(learningPath);

  } catch (error: any) {
    logger.error('Learning Path Generation Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '学习路径生成失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

function findPath(startId: string, endId: string, childMap: Map<string, string[]>): string[] {
  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
  const visited = new Set<string>([startId]);
  
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    
    if (id === endId) {
      return path;
    }
    
    const children = childMap.get(id) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, path: [...path, childId] });
      }
    }
  }
  
  return [];
}

router.get('/progress/:graphId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graphId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: nodes } = await supabase
      .from('nodes')
      .select('id, title, level')
      .eq('graph_id', graphId);

    if (!nodes || nodes.length === 0) {
      return res.json({ 
        totalNodes: 0, 
        masteredNodes: 0, 
        learningNodes: 0,
        newNodes: 0,
        progress: 0 
      });
    }

    const nodeIds = nodes.map(n => n.id);

    const { data: cards } = await supabase
      .from('cards')
      .select('id, node_id')
      .in('node_id', nodeIds);

    const cardIds = cards?.map(c => c.id) || [];

    const { data: progress } = await supabase
      .from('card_progress')
      .select('card_id, stability, difficulty, review_count')
      .eq('user_id', req.user.id)
      .in('card_id', cardIds);

    const nodeProgress = new Map<string, { mastered: boolean; learning: boolean }>();
    
    if (cards && progress) {
      cards.forEach(card => {
        const cardProgress = progress.find(p => p.card_id === card.id);
        if (cardProgress) {
          const mastery = Math.min(1, ((cardProgress.stability || 0) / 30) * (1 - (cardProgress.difficulty || 5) / 10));
          nodeProgress.set(card.node_id, {
            mastered: mastery > 0.8,
            learning: mastery > 0.3 && mastery <= 0.8
          });
        }
      });
    }

    let masteredNodes = 0;
    let learningNodes = 0;
    let newNodes = 0;

    nodes.forEach(node => {
      const np = nodeProgress.get(node.id);
      if (np?.mastered) {
        masteredNodes++;
      } else if (np?.learning) {
        learningNodes++;
      } else {
        newNodes++;
      }
    });

    res.json({
      totalNodes: nodes.length,
      masteredNodes,
      learningNodes,
      newNodes,
      progress: nodes.length > 0 ? Math.round((masteredNodes / nodes.length) * 100) : 0
    });

  } catch (error: any) {
    logger.error('Progress Fetch Error:', error);
    throw new AppError(error.message || '获取进度失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
