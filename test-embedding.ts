import { config } from 'dotenv';
config();

import { aiService } from './api/services/ai/index.js';

interface TestPair {
  title1: string;
  title2: string;
  expectedSimilar: boolean;
  category: string;
}

const testPairs: TestPair[] = [
  // 相似的标题
  { title1: '机器学习基础', title2: '机器学习入门', expectedSimilar: true, category: '相似-同义词' },
  { title1: '深度学习概述', title2: '深度学习简介', expectedSimilar: true, category: '相似-同义词' },
  { title1: '神经网络原理', title2: '神经网络基础原理', expectedSimilar: true, category: '相似-包含关系' },
  { title1: 'Python编程', title2: 'Python程序设计', expectedSimilar: true, category: '相似-同义词' },
  { title1: '数据结构与算法', title2: '算法与数据结构', expectedSimilar: true, category: '相似-顺序调整' },
  { title1: '监督学习', title2: '有监督学习', expectedSimilar: true, category: '相似-同义词' },
  { title1: '卷积神经网络', title2: 'CNN卷积神经网络', expectedSimilar: true, category: '相似-缩写展开' },
  { title1: '自然语言处理', title2: 'NLP自然语言处理', expectedSimilar: true, category: '相似-缩写展开' },
  { title1: '回归分析', title2: '线性回归分析', expectedSimilar: true, category: '相似-包含关系' },
  { title1: '分类算法', title2: '分类器算法', expectedSimilar: true, category: '相似-同义词' },
  
  // 不相似的标题
  { title1: '机器学习基础', title2: '烹饪入门指南', expectedSimilar: false, category: '不相似-完全不同' },
  { title1: '深度学习概述', title2: '篮球技巧训练', expectedSimilar: false, category: '不相似-完全不同' },
  { title1: '神经网络原理', title2: '音乐理论基础', expectedSimilar: false, category: '不相似-完全不同' },
  { title1: 'Python编程', title2: 'Java编程', expectedSimilar: false, category: '不相似-不同语言' },
  { title1: '数据结构与算法', title2: '数据库设计', expectedSimilar: false, category: '不相似-不同领域' },
  { title1: '监督学习', title2: '无监督学习', expectedSimilar: false, category: '不相似-相反概念' },
  { title1: '卷积神经网络', title2: '循环神经网络', expectedSimilar: false, category: '不相似-不同类型' },
  { title1: '自然语言处理', title2: '计算机视觉', expectedSimilar: false, category: '不相似-不同领域' },
  { title1: '回归分析', title2: '分类任务', expectedSimilar: false, category: '不相似-不同任务' },
  { title1: '分类算法', title2: '聚类算法', expectedSimilar: false, category: '不相似-不同方法' },
  
  // 边界情况
  { title1: 'AI', title2: '人工智能', expectedSimilar: true, category: '边界-缩写' },
  { title1: '机器学习', title2: '深度学习', expectedSimilar: false, category: '边界-包含关系但不同' },
  { title1: '前端开发', title2: '后端开发', expectedSimilar: false, category: '边界-同一领域不同方向' },
  { title1: 'React', title2: 'Vue', expectedSimilar: false, category: '边界-同类框架不同实现' },
  { title1: '数学基础', title2: '数学', expectedSimilar: true, category: '边界-包含关系' },
];

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('嵌入向量相似度测试');
  console.log('='.repeat(60));
  console.log();

  const allTitles = new Set<string>();
  testPairs.forEach(p => {
    allTitles.add(p.title1);
    allTitles.add(p.title2);
  });
  
  const uniqueTitles = Array.from(allTitles);
  console.log(`需要生成 ${uniqueTitles.length} 个标题的嵌入向量...\n`);
  
  const embeddings = new Map<string, number[]>();
  
  for (const title of uniqueTitles) {
    const embedding = await aiService.generateEmbedding(title);
    if (embedding) {
      embeddings.set(title, embedding);
      console.log(`✓ 已生成: "${title}"`);
    } else {
      console.log(`✗ 失败: "${title}"`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('测试结果');
  console.log('='.repeat(60) + '\n');
  
  const thresholds = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
  const results: { threshold: number; correct: number; total: number; accuracy: number }[] = [];
  
  for (const threshold of thresholds) {
    let correct = 0;
    let total = 0;
    
    for (const pair of testPairs) {
      const emb1 = embeddings.get(pair.title1);
      const emb2 = embeddings.get(pair.title2);
      
      if (!emb1 || !emb2) continue;
      
      const similarity = cosineSimilarity(emb1, emb2);
      const predictedSimilar = similarity >= threshold;
      const isCorrect = predictedSimilar === pair.expectedSimilar;
      
      if (isCorrect) correct++;
      total++;
    }
    
    results.push({
      threshold,
      correct,
      total,
      accuracy: total > 0 ? (correct / total) * 100 : 0
    });
  }
  
  console.log('阈值 | 正确数 | 总数 | 准确率');
  console.log('-'.repeat(40));
  for (const r of results) {
    console.log(`${r.threshold.toFixed(2)} | ${r.correct.toString().padStart(4)} | ${r.total.toString().padStart(4)} | ${r.accuracy.toFixed(1)}%`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('详细结果 (阈值=0.85)');
  console.log('='.repeat(60) + '\n');
  
  const threshold = 0.85;
  
  for (const pair of testPairs) {
    const emb1 = embeddings.get(pair.title1);
    const emb2 = embeddings.get(pair.title2);
    
    if (!emb1 || !emb2) {
      console.log(`跳过: ${pair.title1} / ${pair.title2} (缺少嵌入)`);
      continue;
    }
    
    const similarity = cosineSimilarity(emb1, emb2);
    const predictedSimilar = similarity >= threshold;
    const isCorrect = predictedSimilar === pair.expectedSimilar;
    const status = isCorrect ? '✓' : '✗';
    
    console.log(`${status} [${pair.category}]`);
    console.log(`  "${pair.title1}" vs "${pair.title2}"`);
    console.log(`  相似度: ${similarity.toFixed(4)} | 预测: ${predictedSimilar ? '相似' : '不相似'} | 实际: ${pair.expectedSimilar ? '相似' : '不相似'}`);
    console.log();
  }
  
  console.log('='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

runTest().catch(console.error);
