import { config } from 'dotenv';
config();

import { aiService } from './api/services/ai/index.js';

const testTitles = [
  '机器学习基础',
  '深度学习概述',
  '神经网络原理',
  'Python编程',
  '数据结构与算法',
  '监督学习',
  '卷积神经网络',
  '自然语言处理',
  '回归分析',
  '分类算法',
];

async function runSpeedTest() {
  console.log('='.repeat(60));
  console.log('嵌入向量生成速度测试');
  console.log('='.repeat(60));
  console.log();

  // 测试 1: 单个生成
  console.log('【测试 1】单个标题生成嵌入向量');
  console.log('-'.repeat(40));
  
  const singleTimes: number[] = [];
  
  for (const title of testTitles) {
    const start = Date.now();
    const embedding = await aiService.generateEmbedding(title);
    const elapsed = Date.now() - start;
    singleTimes.push(elapsed);
    
    console.log(`"${title}" -> ${elapsed}ms (维度: ${embedding?.length || 0})`);
  }
  
  const avgSingle = singleTimes.reduce((a, b) => a + b, 0) / singleTimes.length;
  console.log(`\n平均耗时: ${avgSingle.toFixed(0)}ms`);
  console.log(`总耗时: ${singleTimes.reduce((a, b) => a + b, 0)}ms`);

  // 测试 2: 批量生成
  console.log('\n' + '='.repeat(60));
  console.log('【测试 2】批量生成嵌入向量');
  console.log('-'.repeat(40));
  
  const batchStart = Date.now();
  const embeddings = await aiService.generateEmbeddingsBatch(testTitles);
  const batchElapsed = Date.now() - batchStart;
  
  console.log(`批量生成 ${testTitles.length} 个标题`);
  console.log(`总耗时: ${batchElapsed}ms`);
  console.log(`平均每个: ${(batchElapsed / testTitles.length).toFixed(0)}ms`);
  console.log(`成功: ${embeddings.filter(e => e !== null).length}/${testTitles.length}`);

  // 测试 3: 模拟 AI 生成场景
  console.log('\n' + '='.repeat(60));
  console.log('【测试 3】模拟 AI 生成知识点场景');
  console.log('-'.repeat(40));
  
  // 假设 AI 生成了 5 个知识点，需要检查每个是否重复
  const newTitles = ['机器学习入门', '深度学习简介', 'Python基础', '数据挖掘', '图像识别'];
  
  const checkStart = Date.now();
  
  for (const title of newTitles) {
    const embStart = Date.now();
    const embedding = await aiService.generateEmbedding(title);
    const embTime = Date.now() - embStart;
    console.log(`生成嵌入 "${title}": ${embTime}ms`);
  }
  
  const checkElapsed = Date.now() - checkStart;
  console.log(`\n检查 ${newTitles.length} 个知识点总耗时: ${checkElapsed}ms`);
  console.log(`平均每个: ${(checkElapsed / newTitles.length).toFixed(0)}ms`);

  // 测试 4: 批量检查
  console.log('\n' + '='.repeat(60));
  console.log('【测试 4】批量检查相似度');
  console.log('-'.repeat(40));
  
  const batchCheckStart = Date.now();
  const batchEmbeddings = await aiService.generateEmbeddingsBatch(newTitles);
  const batchCheckElapsed = Date.now() - batchCheckStart;
  
  console.log(`批量生成 ${newTitles.length} 个嵌入: ${batchCheckElapsed}ms`);
  console.log(`平均每个: ${(batchCheckElapsed / newTitles.length).toFixed(0)}ms`);

  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));
  console.log(`
单个生成平均耗时: ${avgSingle.toFixed(0)}ms
批量生成平均耗时: ${(batchElapsed / testTitles.length).toFixed(0)}ms

结论:
- 单个标题嵌入生成约 ${avgSingle.toFixed(0)}ms
- 批量生成效率提升约 ${(avgSingle / (batchElapsed / testTitles.length)).toFixed(1)}x

建议:
- 如果 AI 生成 5 个知识点，检查相似度约需 ${(avgSingle * 5 / 1000).toFixed(1)}s (单个)
- 如果用批量生成，约需 ${(batchElapsed / testTitles.length * 5 / 1000).toFixed(1)}s
`);
}

runSpeedTest().catch(console.error);
