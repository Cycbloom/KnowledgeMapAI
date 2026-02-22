import { config } from 'dotenv';
config();

import { supabaseAdmin } from './api/supabase.js';
import { checkDuplicateGraphTopic } from './api/utils/similaritySearch.js';
import { aiService } from './api/services/ai/index.js';

async function testTopicDuplicateCheck() {
  console.log('=== 测试图谱主题查重功能 ===\n');

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    console.log('❌ 没有找到用户，请先创建用户');
    process.exit(1);
  }

  const testUserId = users[0].id;
  console.log(`使用用户 ID: ${testUserId}\n`);

  const testTopics = [
    '机器学习基础',
    '机器学习入门',
    '深度学习原理',
  ];

  console.log('1. 先创建一些测试图谱...\n');

  const createdGraphIds: string[] = [];

  for (const topic of testTopics) {
    const embedding = await aiService.generateEmbedding(topic);
    
    const { data, error } = await supabaseAdmin
      .from('knowledge_graphs')
      .insert({
        user_id: testUserId,
        title: topic,
        description: `测试图谱：${topic}`,
        embedding,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.log(`创建图谱「${topic}」失败:`, error.message);
    } else if (data) {
      createdGraphIds.push(data.id);
      console.log(`✅ 创建图谱「${topic}」成功 (id: ${data.id})`);
    }
  }

  console.log('\n2. 测试主题查重...\n');

  const testCases = [
    { topic: '机器学习基础', expected: 'duplicate' },
    { topic: '机器学习入门', expected: 'duplicate' },
    { topic: '深度学习原理', expected: 'duplicate' },
    { topic: '自然语言处理', expected: 'unique' },
    { topic: 'Python编程', expected: 'unique' },
  ];

  for (const testCase of testCases) {
    const result = await checkDuplicateGraphTopic(supabaseAdmin, testUserId, testCase.topic, { threshold: 0.85 });
    
    const status = result.isDuplicate ? '❌ 重复' : '✅ 唯一';
    const expected = testCase.expected === 'duplicate' ? '重复' : '唯一';
    const match = (result.isDuplicate ? '重复' : '唯一') === expected ? '✓' : '✗';
    
    console.log(`主题: 「${testCase.topic}」`);
    console.log(`  结果: ${status}, 期望: ${expected} ${match}`);
    
    if (result.similarGraphs.length > 0) {
      console.log(`  相似图谱:`);
      for (const sg of result.similarGraphs) {
        console.log(`    - 「${sg.title}」 相似度: ${(sg.similarity * 100).toFixed(1)}%`);
      }
    }
    console.log();
  }

  console.log('3. 清理测试数据...\n');
  
  for (const graphId of createdGraphIds) {
    await supabaseAdmin
      .from('knowledge_graphs')
      .delete()
      .eq('id', graphId);
  }

  console.log('✅ 测试完成');
  process.exit(0);
}

testTopicDuplicateCheck().catch(console.error);
