import dotenv from 'dotenv';
import { getSupabaseAdmin } from '../api/supabase.js';
import { AIService } from '../api/services/aiService.js';
import { logger } from '../api/utils/logger.js';

dotenv.config();

const aiService = new AIService();

/**
 * 批量为现有节点生成向量
 */
async function backfillEmbeddings() {
  logger.info('🚀 开始为现有节点批量生成向量...');

  // 1. 获取所有节点（重新生成所有向量）
  const { data: nodes, error } = await getSupabaseAdmin()
    .from('knowledge_points')
    .select('id, title, content')
    .or('embedding.is.null'); // 已移除过滤，强制重新生成所有

  if (error) {
    logger.error('❌ 获取节点失败:', error);
    return;
  }

  if (!nodes || nodes.length === 0) {
    logger.info('✅ 没有需要处理的节点。');
    return;
  }

  logger.info(`总计发现 ${nodes.length} 个节点需要处理。`);

  let successCount = 0;
  let failCount = 0;

  for (const node of nodes) {
    try {
      const textToEmbed = `${node.title || ''} ${node.content || ''}`.trim();
      
      if (!textToEmbed) {
        logger.warn(`[跳过] 节点 ${node.id} 没有标题和内容。`);
        continue;
      }

      process.stdout.write(`正在处理节点: ${node.title || node.id}... `);

      const embedding = await aiService.generateEmbedding(textToEmbed);

      if (embedding) {
        // 同步生成稀疏向量（provider 不支持时返回 null，sparse 通道缺省不阻塞）
        const sparse = await aiService.generateSparseEmbedding(textToEmbed);
        const { error: updateError } = await getSupabaseAdmin()
          .from('knowledge_points')
          .update({
            embedding,
            sparse_embedding: sparse ? serializeSparse(sparse) : null,
          })
          .eq('id', node.id);

        if (updateError) {
          throw updateError;
        }

        logger.info('✅ 完成');
        successCount++;
      } else {
        logger.info('❌ 失败 (AI 未返回向量)');
        failCount++;
      }

      // 稍微停顿一下，避免触发 API 频率限制
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      logger.info('❌ 报错');
      logger.error(`节点 ${node.id} 处理出错:`, err);
      failCount++;
    }
  }

  logger.info('\n✨ 批量处理结束:');
  logger.info(`- 成功: ${successCount}`);
  logger.info(`- 失败: ${failCount}`);
}

backfillEmbeddings().catch(err => {
  logger.error('脚本运行出错:', err);
  process.exit(1);
});
