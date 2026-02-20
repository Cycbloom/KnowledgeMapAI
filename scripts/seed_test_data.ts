import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USER = {
  email: 'test@example.com',
  password: 'test123456',
  name: '测试用户',
};

const GRAPH_DATA = {
  title: 'JavaScript 基础知识',
  description: 'JavaScript 语言的核心概念和基础知识，包括变量、函数、对象、数组等重要概念',
  nodes: [
    { title: 'JavaScript', content: 'JavaScript 是一种高级的、解释型的编程语言，是 Web 开发的核心技术之一。它支持面向对象、函数式和事件驱动的编程范式，可以运行在浏览器和 Node.js 环境中。', level: 'root' as const, x: 400, y: 50 },
    { title: '变量与数据类型', content: 'JavaScript 中的变量声明方式包括 var、let 和 const。基本数据类型有：string、number、boolean、null、undefined、symbol 和 bigint。', level: 'core' as const, x: 150, y: 180 },
    { title: '函数', content: '函数是 JavaScript 中的一等公民，可以作为参数传递、作为返回值、赋值给变量。支持函数声明、函数表达式、箭头函数等多种定义方式。', level: 'core' as const, x: 400, y: 180 },
    { title: '对象', content: '对象是 JavaScript 中最复杂的数据类型，是键值对的集合。支持对象字面量、构造函数、Object.create() 等创建方式。', level: 'core' as const, x: 650, y: 180 },
    { title: '异步编程', content: 'JavaScript 的异步编程模型包括回调函数、Promise、async/await。事件循环（Event Loop）是理解异步执行的关键。', level: 'core' as const, x: 900, y: 180 },
    { title: 'let 和 const', content: 'let 声明可变变量，const 声明常量。两者都有块级作用域，不存在变量提升。', level: 'sub' as const, x: 50, y: 320 },
    { title: 'var 关键字', content: 'var 是 ES5 的变量声明方式，存在变量提升和函数作用域。', level: 'sub' as const, x: 150, y: 320 },
    { title: '数据类型转换', content: 'JavaScript 支持显式转换（Number()、String()、Boolean()）和隐式转换。', level: 'sub' as const, x: 250, y: 320 },
    { title: '箭头函数', content: 'ES6 引入的简洁函数语法，没有自己的 this、arguments、super。', level: 'sub' as const, x: 350, y: 320 },
    { title: '闭包', content: '闭包是指函数能够访问其词法作用域外的变量。常用于数据私有化、函数工厂等场景。', level: 'sub' as const, x: 450, y: 320 },
    { title: '原型链', content: 'JavaScript 使用原型继承机制。每个对象都有 __proto__ 属性指向其原型对象。', level: 'sub' as const, x: 600, y: 320 },
    { title: 'ES6 Class', content: 'class 是 ES6 引入的语法糖，本质上仍是原型继承。', level: 'sub' as const, x: 700, y: 320 },
    { title: 'Promise', content: 'Promise 是异步编程的解决方案，代表一个异步操作的最终结果。有三种状态：pending、fulfilled、rejected。', level: 'sub' as const, x: 850, y: 320 },
    { title: 'async/await', content: 'async/await 是 Promise 的语法糖，让异步代码看起来像同步代码。', level: 'sub' as const, x: 950, y: 320 },
    { title: 'Promise.all()', content: 'Promise.all() 接收一个 Promise 数组，当所有 Promise 都 resolve 时才 resolve。', level: 'leaf' as const, x: 850, y: 450 },
    { title: 'Promise.race()', content: 'Promise.race() 返回最先完成的 Promise 结果。', level: 'leaf' as const, x: 950, y: 450 },
  ],
  edges: [
    { source: 'JavaScript', target: '变量与数据类型' },
    { source: 'JavaScript', target: '函数' },
    { source: 'JavaScript', target: '对象' },
    { source: 'JavaScript', target: '异步编程' },
    { source: '变量与数据类型', target: 'let 和 const' },
    { source: '变量与数据类型', target: 'var 关键字' },
    { source: '变量与数据类型', target: '数据类型转换' },
    { source: '函数', target: '箭头函数' },
    { source: '函数', target: '闭包' },
    { source: '对象', target: '原型链' },
    { source: '对象', target: 'ES6 Class' },
    { source: '异步编程', target: 'Promise' },
    { source: '异步编程', target: 'async/await' },
    { source: 'Promise', target: 'Promise.all()' },
    { source: 'Promise', target: 'Promise.race()' },
    { source: '箭头函数', target: '闭包', type: 'related' },
    { source: 'Promise', target: 'async/await', type: 'related' },
  ],
  cards: [
    { nodeTitle: '函数', question: '什么是 JavaScript 中的闭包？请举例说明它的应用场景。', answer: '闭包是指函数能够访问其词法作用域外的变量，即使该函数在其原始作用域之外执行。', explanation: '闭包的核心概念是函数和其词法环境的组合。常见应用包括：数据私有化、函数工厂、模块模式。', cardType: 'qa', difficulty: 3 },
    { nodeTitle: 'Promise', question: 'Promise 有哪几种状态？状态之间如何转换？', answer: 'Promise 有三种状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。', explanation: '状态转换规则：pending 可以变为 fulfilled 或 rejected，状态一旦改变就不可逆。', cardType: 'qa', difficulty: 2 },
    { nodeTitle: 'let 和 const', question: '以下哪个关键字声明的变量具有块级作用域？', answer: 'let', explanation: 'let 和 const 都是 ES6 引入的块级作用域变量声明方式。', cardType: 'choice', difficulty: 1 },
    { nodeTitle: 'ES6 Class', question: 'ES6 的 class 本质上是 JavaScript 原型继承的语法糖。', answer: 'true', explanation: 'class 语法并没有引入新的面向对象继承模型，它仍然是基于原型的继承。', cardType: 'true_false', difficulty: 2 },
    { nodeTitle: 'async/await', question: 'async 函数返回一个 ___ 对象，await 只能在 ___ 函数内部使用。', answer: 'Promise, async', explanation: 'async 函数总是返回一个 Promise 对象。', cardType: 'fill_in_the_blank', difficulty: 2 },
  ],
};

async function createTestUser() {
  console.log('🔧 Creating test user...');
  
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(u => u.email === TEST_USER.email);
  
  if (existingUser) {
    console.log('✅ Test user already exists:', existingUser.id);
    return existingUser;
  }
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    user_metadata: {
      name: TEST_USER.name,
    },
  });
  
  if (error) {
    console.error('❌ Error creating user:', error);
    throw error;
  }
  
  console.log('✅ Test user created:', data.user.id);
  return data.user;
}

async function updateUserProfile(userId: string) {
  console.log('🔧 Updating user profile...');
  
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'premium',
      xp: 1500,
      level: 5,
      settings: { theme: 'dark', language: 'zh-CN', notifications: true },
    })
    .eq('id', userId);
  
  if (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
  
  console.log('✅ User profile updated');
}

async function createKnowledgeGraphs(userId: string) {
  console.log('🔧 Creating knowledge graphs...');
  
  const graphs = [
    { title: 'JavaScript 基础知识', description: GRAPH_DATA.description, is_public: true, is_favorite: true },
    { title: 'React 开发指南', description: 'React 框架的核心概念、组件设计、状态管理等知识点', is_public: true, is_favorite: false },
    { title: 'Python 数据分析', description: '使用 Python 进行数据分析的完整知识体系，包括 NumPy、Pandas、Matplotlib 等', is_public: false, is_favorite: true },
  ];
  
  for (const graph of graphs) {
    const { data: existing } = await supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('user_id', userId)
      .eq('title', graph.title)
      .single();
    
    if (existing) {
      console.log(`  ⏭️  Graph "${graph.title}" already exists`);
      continue;
    }
    
    const { error } = await supabase
      .from('knowledge_graphs')
      .insert({
        user_id: userId,
        ...graph,
        settings: { layout: 'force-directed', theme: 'default' },
      });
    
    if (error) {
      console.error(`  ❌ Error creating graph "${graph.title}":`, error);
    } else {
      console.log(`  ✅ Graph "${graph.title}" created`);
    }
  }
}

async function createNodesAndEdges(userId: string) {
  console.log('🔧 Creating nodes and edges...');
  
  const { data: graph } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('user_id', userId)
    .eq('title', GRAPH_DATA.title)
    .single();
  
  if (!graph) {
    console.error('❌ Graph not found');
    return;
  }
  
  const { data: existingNodes } = await supabase
    .from('nodes')
    .select('id')
    .eq('graph_id', graph.id)
    .limit(1);
  
  if (existingNodes && existingNodes.length > 0) {
    console.log('  ⏭️  Nodes already exist');
    return;
  }
  
  const nodeMap: Record<string, string> = {};
  
  for (const node of GRAPH_DATA.nodes) {
    const { data, error } = await supabase
      .from('nodes')
      .insert({
        graph_id: graph.id,
        title: node.title,
        content: node.content,
        level: node.level,
        x_position: node.x,
        y_position: node.y,
        is_accepted: true,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating node "${node.title}":`, error);
    } else {
      nodeMap[node.title] = data.id;
      console.log(`  ✅ Node "${node.title}" created`);
    }
  }
  
  console.log('🔧 Creating edges...');
  
  for (const edge of GRAPH_DATA.edges) {
    const sourceId = nodeMap[edge.source];
    const targetId = nodeMap[edge.target];
    
    if (!sourceId || !targetId) {
      console.error(`  ❌ Edge nodes not found: ${edge.source} -> ${edge.target}`);
      continue;
    }
    
    const { error } = await supabase
      .from('edges')
      .insert({
        graph_id: graph.id,
        source_node_id: sourceId,
        target_node_id: targetId,
        relationship_type: edge.type || 'contains',
        weight: edge.type === 'related' ? 2 : 1,
      });
    
    if (error) {
      console.error(`  ❌ Error creating edge "${edge.source}" -> "${edge.target}":`, error);
    } else {
      console.log(`  ✅ Edge "${edge.source}" -> "${edge.target}" created`);
    }
  }
  
  return { graphId: graph.id, nodeMap };
}

async function createStudyCards(userId: string, graphId: string, nodeMap: Record<string, string>) {
  console.log('🔧 Creating study cards...');
  
  const { data: existingCards } = await supabase
    .from('study_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('graph_id', graphId)
    .limit(1);
  
  if (existingCards && existingCards.length > 0) {
    console.log('  ⏭️  Study cards already exist');
    return;
  }
  
  for (const card of GRAPH_DATA.cards) {
    const nodeId = nodeMap[card.nodeTitle];
    
    if (!nodeId) {
      console.error(`  ❌ Node not found for card: ${card.nodeTitle}`);
      continue;
    }
    
    const { error } = await supabase
      .from('study_cards')
      .insert({
        node_id: nodeId,
        user_id: userId,
        graph_id: graphId,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.cardType,
        difficulty: card.difficulty,
        review_count: 0,
      });
    
    if (error) {
      console.error(`  ❌ Error creating card for "${card.nodeTitle}":`, error);
    } else {
      console.log(`  ✅ Study card for "${card.nodeTitle}" created`);
    }
  }
}

async function createStudyProgress(userId: string, graphId: string) {
  console.log('🔧 Creating study progress...');
  
  const { error } = await supabase
    .from('study_progress')
    .upsert({
      user_id: userId,
      graph_id: graphId,
      total_nodes: 16,
      mastered_nodes: 5,
      progress_percentage: 31.25,
      study_streak: 3,
    }, { onConflict: 'user_id,graph_id' });
  
  if (error) {
    console.error('❌ Error creating study progress:', error);
  } else {
    console.log('✅ Study progress created');
  }
}

async function createFocusSessions(userId: string) {
  console.log('🔧 Creating focus sessions...');
  
  const sessions = [
    { start: '2 hours', duration: 30 },
    { start: '1 day', duration: 25 },
    { start: '2 days', duration: 30 },
  ];
  
  for (const session of sessions) {
    const startTime = new Date(Date.now() - parseTimeOffset(session.start));
    const endTime = new Date(startTime.getTime() + session.duration * 60 * 1000);
    
    const { error } = await supabase
      .from('focus_sessions')
      .insert({
        user_id: userId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: session.duration * 60,
        mode: 'focus',
        completed: true,
      });
    
    if (error) {
      console.error(`  ❌ Error creating focus session:`, error);
    } else {
      console.log(`  ✅ Focus session created (${session.start} ago)`);
    }
  }
}

async function createDailyTasks(userId: string) {
  console.log('🔧 Creating daily tasks...');
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const tasks = [
    { date: today, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: today, type: 'focus_time', status: 'in_progress', progress: 15, target: 30, xp: 30 },
    { date: yesterday, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: yesterday, type: 'focus_time', status: 'completed', progress: 30, target: 30, xp: 30 },
  ];
  
  for (const task of tasks) {
    const { error } = await supabase
      .from('daily_tasks')
      .upsert({
        user_id: userId,
        task_date: task.date,
        task_type: task.type,
        status: task.status,
        progress: task.progress,
        target: task.target,
        xp_reward: task.xp,
        completed_at: task.status === 'completed' ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,task_date,task_type' });
    
    if (error) {
      console.error(`  ❌ Error creating task:`, error);
    } else {
      console.log(`  ✅ Task "${task.type}" for ${task.date} created`);
    }
  }
}

async function unlockAchievements(userId: string) {
  console.log('🔧 Unlocking achievements...');
  
  const achievementCodes = ['streak_3', 'focus_10', 'mastery_1', 'creation_graph_1', 'creation_node_10'];
  
  const { data: achievements } = await supabase
    .from('achievements')
    .select('id, code')
    .in('code', achievementCodes);
  
  if (!achievements || achievements.length === 0) {
    console.log('  ⏭️  No achievements found');
    return;
  }
  
  for (const achievement of achievements) {
    const { error } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievement.id,
        unlocked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'user_id,achievement_id' });
    
    if (error) {
      console.error(`  ❌ Error unlocking achievement "${achievement.code}":`, error);
    } else {
      console.log(`  ✅ Achievement "${achievement.code}" unlocked`);
    }
  }
}

function parseTimeOffset(offset: string): number {
  const match = offset.match(/^(\d+)\s*(hour|day|week|month)s?$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'hour': return value * 60 * 60 * 1000;
    case 'day': return value * 24 * 60 * 60 * 1000;
    case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    case 'month': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function main() {
  console.log('🚀 Starting test data seed...\n');
  
  try {
    const user = await createTestUser();
    await updateUserProfile(user.id);
    await createKnowledgeGraphs(user.id);
    const result = await createNodesAndEdges(user.id);
    
    if (result) {
      await createStudyCards(user.id, result.graphId, result.nodeMap);
      await createStudyProgress(user.id, result.graphId);
    }
    
    await createFocusSessions(user.id);
    await createDailyTasks(user.id);
    await unlockAchievements(user.id);
    
    console.log('\n✅ Test data seed completed!');
    console.log('\n📋 Test Account Info:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
    console.log(`   User ID: ${user.id}`);
    
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
