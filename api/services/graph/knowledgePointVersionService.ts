import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import type { KnowledgePoint, KnowledgePointVersion, KnowledgePointVersionDiff, KnowledgePointVersionWithDiff } from '../../../shared/types/index';

export interface ListVersionsOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedVersionsResult {
  items: KnowledgePointVersion[];
  total: number;
}

export class KnowledgePointVersionService {
  async listVersions(
    supabase: SupabaseClient,
    knowledgePointId: string,
    options?: ListVersionsOptions
  ): Promise<PaginatedVersionsResult> {
    const { limit = 20, offset = 0 } = options || {};

    const { data, error, count } = await supabase
      .from('knowledge_point_versions')
      .select('*', { count: 'exact' })
      .eq('knowledge_point_id', knowledgePointId)
      .order('version_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('List knowledge point versions error:', error);
      throw error;
    }

    return {
      items: (data || []) as KnowledgePointVersion[],
      total: count || 0,
    };
  }

  async getVersion(
    supabase: SupabaseClient,
    knowledgePointId: string,
    versionNumber: number
  ): Promise<KnowledgePointVersion | null> {
    const { data, error } = await supabase
      .from('knowledge_point_versions')
      .select('*')
      .eq('knowledge_point_id', knowledgePointId)
      .eq('version_number', versionNumber)
      .maybeSingle();

    if (error) {
      logger.error('Get knowledge point version error:', error);
      throw error;
    }

    return data as KnowledgePointVersion | null;
  }

  async getLatestVersion(
    supabase: SupabaseClient,
    knowledgePointId: string
  ): Promise<KnowledgePointVersion | null> {
    const { data, error } = await supabase
      .from('knowledge_point_versions')
      .select('*')
      .eq('knowledge_point_id', knowledgePointId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Get latest knowledge point version error:', error);
      throw error;
    }

    return data as KnowledgePointVersion | null;
  }

  async compareVersions(
    supabase: SupabaseClient,
    knowledgePointId: string,
    versionNumber1: number,
    versionNumber2: number
  ): Promise<KnowledgePointVersionWithDiff[]> {
    const [v1, v2] = await Promise.all([
      this.getVersion(supabase, knowledgePointId, versionNumber1),
      this.getVersion(supabase, knowledgePointId, versionNumber2),
    ]);

    if (!v1 || !v2) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: 'One or both versions not found' });
    }

    const [older, newer] = v1.version_number < v2.version_number ? [v1, v2] : [v2, v1];
    const diffs = this.computeDiffs(older, newer);

    return [
      { ...older, diffs: diffs.filter(d => d.field === 'old') },
      { ...newer, diffs, previous_version: older },
    ];
  }

  private computeDiffs(
    older: KnowledgePointVersion,
    newer: KnowledgePointVersion
  ): KnowledgePointVersionDiff[] {
    const diffs: KnowledgePointVersionDiff[] = [];
    const fields: (keyof KnowledgePointVersion)[] = ['title', 'content', 'summary', 'learning_material', 'properties'];

    for (const field of fields) {
      const oldVal = older[field];
      const newVal = newer[field];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({
          field,
          old_value: oldVal,
          new_value: newVal,
        });
      }
    }

    return diffs;
  }

  async rollback(
    supabase: SupabaseClient,
    knowledgePointId: string,
    versionNumber: number,
    _userId: string
  ): Promise<KnowledgePoint> {
    const version = await this.getVersion(supabase, knowledgePointId, versionNumber);

    if (!version) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: 'Version not found' });
    }

    const kp = await supabase
      .from('knowledge_points')
      .select('*')
      .eq('id', knowledgePointId)
      .maybeSingle();

    if (!kp.data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: 'Knowledge point not found' });
    }

    const { data: updatedKp, error } = await supabase
      .from('knowledge_points')
      .update({
        title: version.title,
        content: version.content,
        summary: version.summary,
        learning_material: version.learning_material,
        properties: version.properties,
        updated_at: new Date().toISOString(),
      })
      .eq('id', knowledgePointId)
      .select()
      .single();

    if (error) {
      logger.error('Rollback knowledge point error:', error);
      throw error;
    }

    return updatedKp as KnowledgePoint;
  }

  async getVersionHistory(
    supabase: SupabaseClient,
    knowledgePointId: string,
    options?: ListVersionsOptions
  ): Promise<{
    versions: KnowledgePointVersionWithDiff[];
    total: number;
  }> {
    const { items, total } = await this.listVersions(supabase, knowledgePointId, options);

    const versionsWithDiffs: KnowledgePointVersionWithDiff[] = [];

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const previous = i < items.length - 1 ? items[i + 1] : undefined;

      if (previous) {
        const diffs = this.computeDiffs(previous, current);
        versionsWithDiffs.push({
          ...current,
          diffs,
          previous_version: previous,
        });
      } else {
        versionsWithDiffs.push({
          ...current,
          diffs: [],
        });
      }
    }

    return {
      versions: versionsWithDiffs,
      total,
    };
  }

  async createManualVersion(
    supabase: SupabaseClient,
    knowledgePointId: string,
    changeSummary: string,
    userId: string
  ): Promise<KnowledgePointVersion> {
    const kp = await supabase
      .from('knowledge_points')
      .select('*')
      .eq('id', knowledgePointId)
      .maybeSingle();

    if (!kp.data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { message: 'Knowledge point not found' });
    }

    const { data: maxVersion } = await supabase
      .from('knowledge_point_versions')
      .select('version_number')
      .eq('knowledge_point_id', knowledgePointId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (maxVersion?.version_number || 0) + 1;

    const { data: newVersion, error } = await supabase
      .from('knowledge_point_versions')
      .insert({
        knowledge_point_id: knowledgePointId,
        version_number: nextVersion,
        title: kp.data.title,
        content: kp.data.content,
        summary: kp.data.summary,
        learning_material: kp.data.learning_material,
        properties: kp.data.properties,
        change_summary: changeSummary,
        changed_by: userId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Create manual version error:', error);
      throw error;
    }

    return newVersion as KnowledgePointVersion;
  }
}

export const knowledgePointVersionService = new KnowledgePointVersionService();
