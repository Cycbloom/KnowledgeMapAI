import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction, TaskControl, TaskAbortError } from './index';
import { contentGenerationService } from '../ai/contentGenerationService';
import { buildGraphDisambiguationContext } from '../graph/graphDisambiguationContext';
import { resolveLocalizedText, BASE_CONTENT_LANG, type LocalizedText } from '@shared/utils/localization';
import { logger } from '../../utils/logger';
import type { Keyword } from '@shared/types/graph';

interface GenerateLearningMaterialPayload {
  knowledge_point_id: string;
  language: string;
  graph_id?: string;
  level?: string;
  schema_id?: string;
  /** 强制重新生成：跳过「已存在则幂等跳过」检查（用于用户手动重新生成） */
  force?: boolean;
}

/**
 * 学习资料异步生成处理器（预生成管道核心之一）。
 *
 * 将原本「页面访问时同步生成」的学习资料链路转为后台任务：
 * - 幂等：目标语言资料已存在非空时直接完成，避免重复消耗 AI 额度；
 * - 生成成功后回写 knowledge_points.learning_material / keywords（按语言 key）；
 * - 协作式中断（pause/cancel）在 AI 调用前后检查点响应，避免半成品落库。
 */
export class GenerateLearningMaterialProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: GenerateLearningMaterialPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    const language = payload.language || BASE_CONTENT_LANG;

    try {
      const { data: kp, error: fetchError } = await supabase
        .from('knowledge_points')
        .select('id, title, content, learning_material, keywords')
        .eq('id', payload.knowledge_point_id)
        .maybeSingle();

      if (fetchError || !kp) {
        await updateTaskStatus(
          supabase,
          taskId,
          'failed',
          null,
          undefined,
          `Knowledge point ${payload.knowledge_point_id} not found`,
          userId,
        );
        return;
      }

      const topic = resolveLocalizedText(kp.title as LocalizedText, language);
      const context = resolveLocalizedText(kp.content as LocalizedText, language);
      const existingMaterial = (kp.learning_material as Record<string, string> | null) ?? {};
      const existingKeywords = (kp.keywords as Record<string, Keyword[]> | null) ?? {};

      // 幂等跳过：该语言资料已存在且非空（force=true 时强制重新生成）
      const material = existingMaterial[language];
      if (!payload.force && material && material.trim().length > 0) {
        logger.info(
          `[GenerateLearningMaterial] skip ${payload.knowledge_point_id} (${language}) - already exists`,
        );
        await updateTaskStatus(supabase, taskId, 'completed', {
          skipped: true,
          progress: 100,
        }, undefined, undefined, userId);
        return;
      }

      control.throwIfAborted();

      await updateTaskStatus(supabase, taskId, 'in_progress', {
        stage: 'generating',
        stageLabel: `正在生成「${topic || payload.knowledge_point_id}」学习资料（${language}）`,
        progress: 10,
        current_node: topic || payload.knowledge_point_id,
      }, undefined, undefined, userId);
      control.throwIfAborted();

      // 消歧上下文（图谱元数据 + 祖先链 + 直接子节点）：best-effort，失败不影响生成
      const graphCtx = await buildGraphDisambiguationContext(
        supabase,
        payload.graph_id,
        payload.knowledge_point_id,
        language,
      );

      const result = await contentGenerationService.generateLearningMaterial(topic, context, {
        userId,
        graphId: payload.graph_id,
        level: payload.level,
        language,
        schema_id: payload.schema_id,
        graphTitle: graphCtx.graphTitle,
        graphDescription: graphCtx.graphDescription,
        graphDomain: graphCtx.graphDomain,
        parentChain: graphCtx.parentChain,
        childrenOutline: graphCtx.childrenOutline,
      });

      control.throwIfAborted();

      const { error: updateError } = await supabase
        .from('knowledge_points')
        .update({
          learning_material: { ...existingMaterial, [language]: result.content },
          keywords: { ...existingKeywords, [language]: result.keywords },
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.knowledge_point_id);

      if (updateError) {
        logger.error(
          `[GenerateLearningMaterial] failed to save material for ${payload.knowledge_point_id}:`,
          updateError,
        );
        await updateTaskStatus(supabase, taskId, 'failed', null, undefined, updateError.message, userId);
        return;
      }

      await updateTaskStatus(supabase, taskId, 'completed', {
        progress: 100,
        count: 1,
        language,
      }, undefined, undefined, userId);

      logger.info(
        `Generate learning material task ${taskId} completed for ${payload.knowledge_point_id} (${language})`,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Generate learning material task ${taskId} ${error.reason}`);
        await updateTaskStatus(supabase, taskId, error.reason, undefined, undefined, undefined, userId);
        return;
      }
      logger.error(`Generate learning material task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, errorMessage, userId);
    }
  }
}

registerProcessor('generate_learning_material', new GenerateLearningMaterialProcessor());
