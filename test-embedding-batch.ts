import { config } from 'dotenv';
config();

import { aiService } from './api/services/ai/index.js';

async function testConcurrentBatch() {
  console.log('=== 测试新的并发批处理实现 ===\n');

  const testTexts = [
    '机器学习基础',
    '深度学习入门',
    '神经网络原理',
    '自然语言处理',
    '计算机视觉',
    '强化学习算法',
    '数据结构与算法',
    '操作系统原理',
    '数据库系统概念',
    '计算机网络基础'
  ];

  console.log(`Test texts count: ${testTexts.length}\n`);

  // 测试新的并发批处理
  console.log('--- 并发批处理 (并发数: 5) ---');
  const start = Date.now();

  const embeddings = await aiService.generateEmbeddingsBatch(testTexts);

  const total = Date.now() - start;

  console.log(`\n总耗时: ${total}ms`);
  console.log(`平均: ${(total / testTexts.length).toFixed(0)}ms/条`);
  console.log(`\n结果:`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < embeddings.length; i++) {
    const emb = embeddings[i];
    if (emb) {
      success++;
      console.log(`  [${i + 1}] "${testTexts[i]}" - ${emb.length} dims`);
    } else {
      failed++;
      console.log(`  [${i + 1}] "${testTexts[i]}" - FAILED`);
    }
  }

  console.log(`\n成功: ${success}, 失败: ${failed}`);
  console.log('\n=== 测试完成 ===');

  process.exit(0);
}

testConcurrentBatch().catch(console.error);
