import dotenv from 'dotenv';
import { supabaseAdmin } from '../api/supabase.js';
import { AIService } from '../api/services/aiService.js';

dotenv.config();

const aiService = new AIService();

/**
 * 批量为现有节点生成向量
 */
async function backfillEmbeddings() {
  console.log('🚀 开始为现有节点批量生成向量...');

  // 1. 获取所有没有向量或向量维度不正确的节点
  // 注意：由于我们刚刚改了维度到 1024，建议清理旧的向量重新生成
  const { data: nodes, error } = await supabaseAdmin
    .from('nodes')
    .select('id, title, content')
    .or('embedding.is.null'); // 只处理没有向量的节点

  if (error) {
    console.error('❌ 获取节点失败:', error);
    return;
  }

  if (!nodes || nodes.length === 0) {
    console.log('✅ 没有需要处理的节点。');
    return;
  }

  console.log(`总计发现 ${nodes.length} 个节点需要处理。`);

  let successCount = 0;
  let failCount = 0;

  for (const node of nodes) {
    try {
      const textToEmbed = `${node.title || ''} ${node.content || ''}`.trim();
      
      if (!textToEmbed) {
        console.warn(`[跳过] 节点 ${node.id} 没有标题和内容。`);
        continue;
      }

      process.stdout.write(`正在处理节点: ${node.title || node.id}... `);

      const embedding = await aiService.generateEmbedding(textToEmbed);

      if (embedding) {
        const { error: updateError } = await supabaseAdmin
          .from('nodes')
          .update({ embedding })
          .eq('id', node.id);

        if (updateError) {
          throw updateError;
        }
        
        console.log('✅ 完成');
        successCount++;
      } else {
        console.log('❌ 失败 (AI 未返回向量)');
        failCount++;
      }
      
      // 稍微停顿一下，避免触发 API 频率限制
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.log('❌ 报错');
      console.error(`节点 ${node.id} 处理出错:`, err);
      failCount++;
    }
  }

  console.log('\n✨ 批量处理结束:');
  console.log(`- 成功: ${successCount}`);
  console.log(`- 失败: ${failCount}`);
}

backfillEmbeddings().catch(err => {
  console.error('脚本运行出错:', err);
  process.exit(1);
});
