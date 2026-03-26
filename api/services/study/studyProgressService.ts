import { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

export interface StudyProgress {
  id: string;
  user_id: string;
  graph_id: string;
  total_nodes: number;
  mastered_nodes: number;
  progress_percentage: number;
  study_streak: number;
  updated_at: string;
}

export interface UpdateProgressData {
  total_nodes?: number;
  mastered_nodes?: number;
  progress_percentage?: number;
  study_streak?: number;
}

export class StudyProgressService {
  async getProgress(
    supabase: SupabaseClient,
    userId: string,
    graphId: string
  ): Promise<StudyProgress | null> {
    const { data, error } = await supabase
      .from('study_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('graph_id', graphId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(
        '学习进度获取失败',
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data;
  }

  async updateProgress(
    supabase: SupabaseClient,
    userId: string,
    graphId: string,
    data: UpdateProgressData
  ): Promise<StudyProgress> {
    const { data: progress, error } = await supabase
      .from('study_progress')
      .upsert(
        {
          user_id: userId,
          graph_id: graphId,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,graph_id' }
      )
      .select()
      .single();

    if (error) {
      throw new AppError(
        '学习进度更新失败',
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return progress;
  }

  async recalculateProgress(
    supabase: SupabaseClient,
    userId: string,
    graphId: string
  ): Promise<StudyProgress> {
    const { data: graphNodes, error: gnError } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (gnError) {
      throw new AppError(
        '学习进度重算失败',
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }

    const totalNodes = graphNodes?.length || 0;

    if (totalNodes === 0) {
      return this.updateProgress(supabase, userId, graphId, {
        total_nodes: 0,
        mastered_nodes: 0,
        progress_percentage: 0,
      });
    }

    const knowledgePointIds = graphNodes?.map(gn => gn.knowledge_point_id) || [];

    const { data: cards, error: cardsError } = await supabase
      .from('study_cards')
      .select('knowledge_point_id, fsrs_state')
      .eq('user_id', userId)
      .eq('graph_id', graphId)
      .in('knowledge_point_id', knowledgePointIds);

    if (cardsError) {
      throw new AppError(
        '学习进度重算失败',
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }

    const masteredKnowledgePoints = new Set(
      cards
        ?.filter(c => c.fsrs_state === 2)
        .map(c => c.knowledge_point_id) || []
    );

    const masteredNodes = masteredKnowledgePoints.size;
    const progressPercentage = Math.round((masteredNodes / totalNodes) * 100 * 100) / 100;

    return this.updateProgress(supabase, userId, graphId, {
      total_nodes: totalNodes,
      mastered_nodes: masteredNodes,
      progress_percentage: progressPercentage,
    });
  }

  async getAllProgress(
    supabase: SupabaseClient,
    userId: string
  ): Promise<StudyProgress[]> {
    const { data, error } = await supabase
      .from('study_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw new AppError(
        '学习进度获取失败',
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data || [];
  }

  async incrementStreak(
    supabase: SupabaseClient,
    userId: string,
    graphId: string
  ): Promise<StudyProgress> {
    const current = await this.getProgress(supabase, userId, graphId);
    const newStreak = (current?.study_streak || 0) + 1;

    return this.updateProgress(supabase, userId, graphId, {
      study_streak: newStreak,
    });
  }

  async resetStreak(
    supabase: SupabaseClient,
    userId: string,
    graphId: string
  ): Promise<StudyProgress> {
    return this.updateProgress(supabase, userId, graphId, {
      study_streak: 0,
    });
  }
}

export const studyProgressService = new StudyProgressService();
