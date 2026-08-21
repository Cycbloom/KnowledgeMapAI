import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

dotenv.config();

/**
 * Credentials shape intentionally mirrors the browser-side OwnerCredentials in
 * src/utils/silentAuth.ts (localStorage key `km-owner-credentials`). Same format
 * means we can hand off seed-created users directly to the frontend without any
 * transformation.
 */
interface OwnerCredentials {
  email: string;
  password: string;
}

/** Supabase GoTrue owner user plus the raw credentials required by the frontend. */
type SeedOwnerUser = {
  id: string;
  email?: string;
  role?: string;
  phone?: string | undefined;
  created_at?: string;
  /** Credentials payload the frontend expects in localStorage["km-owner-credentials"]. */
  credentials: OwnerCredentials;
};

const CREDENTIALS_OUTPUT_FILE = path.resolve(
  import.meta.dirname ?? process.cwd(),
  '../.seed-owner-credentials.json',
);

/**
 * Mirrors src/utils/silentAuth.ts generateCredentials — same email layout,
 * same password strength (32 random bytes → base64). The generated email
 * format `owner-<uuid>@local.app` matches what provisionOwner() creates on
 * the frontend so both sides produce indistinguishable accounts.
 */
const generateOwnerCredentials = (): OwnerCredentials => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const password = Buffer.from(bytes).toString('base64');
  return {
    email: `owner-${crypto.randomUUID()}@local.app`,
    password,
  };
};

/**
 * Persist seed credentials to disk so later scripts (e2e setup, ownership
 * migration helpers, db:seed re-runs against non-empty auth.users) can
 * recover exactly which email/password pair owns the demo rows in public.*
 *
 * File location: project root `.seed-owner-credentials.json` — remember to
 * keep it gitignored (it contains a live bcrypt-hashed password).
 */
async function persistSeedCredentials(creds: OwnerCredentials & { userId: string }): Promise<void> {
  try {
    await mkdir(path.dirname(CREDENTIALS_OUTPUT_FILE), { recursive: true });
    await writeFile(CREDENTIALS_OUTPUT_FILE, JSON.stringify(creds, null, 2), 'utf-8');
  } catch (err) {
    console.warn('⚠️  Could not write credentials file (skipping — not fatal):', (err as Error).message);
  }
}

/** Print a one-liner the user can paste directly into DevTools Console. */
function printLocalStorageInjectCommand(creds: OwnerCredentials): void {
  const payload = JSON.stringify(JSON.stringify(creds)); // double-encode for the JS string literal
  console.log('');
  console.log('═══════════════ Connect frontend to this seed ═══════════════');
  console.log('  Demo rows in public.* are tied to the owner account below.');
  console.log('  To see them in the app, run this in DevTools Console (F12):');
  console.log('');
  console.log(`     localStorage.clear();`);
  console.log(`     localStorage.setItem("km-owner-credentials", ${payload});`);
  console.log(`     location.reload();`);
  console.log('');
  console.log(`  Owner credentials (manual sign-in fallback):`);
  console.log(`        Email:    ${creds.email}`);
  console.log(`        Password: ${creds.password}`);
  console.log(`  Saved to: .seed-owner-credentials.json`);
  console.log('══════════════════════════════════════════════════════════════');
}

/** Try load a previous seed run's saved credentials; return null if userId mismatch or file missing. */
async function loadPersistedCredentials(userId: string): Promise<OwnerCredentials | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(CREDENTIALS_OUTPUT_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed && typeof parsed === 'object' &&
      'userId' in parsed && (parsed as { userId?: string }).userId === userId &&
      'email' in parsed && typeof (parsed as { email: unknown }).email === 'string' &&
      'password' in parsed && typeof (parsed as { password: unknown }).password === 'string'
    ) {
      return { email: parsed.email as string, password: parsed.password as string };
    }
  } catch {
    // file not found / malformed JSON → fall through to regeneration
  }
  return null;
}

/**
 * Overwrite a user's bcrypt password hash via plain Postgres UPDATE.
 * Needed when we "adopt" a pre-existing user (e.g. created by an earlier
 * frontend provisionOwner run) — we have no way to recover the original
 * random password, so we rotate it to a freshly generated one and print the
 * matching localStorage payload for the user to apply.
 */
async function resetUserPasswordViaPg(userId: string, creds: OwnerCredentials): Promise<boolean> {
  const pool = buildPgPool();
  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    const result = await client.query(
      `UPDATE auth.users
          SET encrypted_password = crypt($1::text, gen_salt('bf')),
              email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
              updated_at = NOW(),
              raw_user_meta_data = COALESCE(NULLIF(raw_user_meta_data, '{}'::jsonb), '{"name":"Owner"}'::jsonb)
        WHERE id = $2::uuid
          AND (is_sso_user = false OR is_sso_user IS NULL)`,
      [creds.password, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[seed_test_data] pg UPDATE auth.users password failed:', (err as Error).message);
    return false;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

/**
 * For an existing auth.users row, obtain a usable {email, password} pair that
 * matches the localStorage["km-owner-credentials"] contract expected by the
 * frontend's silentSignIn. Preferences:
 *   1. Reuse .seed-owner-credentials.json if userId matches (repeatable runs).
 *   2. Otherwise rotate the password via SQL so we know a valid value, and
 *      write the rotated credentials back to the JSON file.
 */
async function materializeCredentialsForExistingUser(user: {
  id: string;
  email?: string | null;
}): Promise<OwnerCredentials> {
  const cached = await loadPersistedCredentials(user.id);
  if (cached) return cached;
  const fresh: OwnerCredentials = user.email && /^owner-[0-9a-f-]{36}@local\.app$/i.test(user.email)
    // The user was created by an earlier provisionOwner run — keep the stable
    // owner-<uuid>@local.app email, only rotate the unknown password.
    ? { email: user.email, password: generateOwnerCredentials().password }
    // Otherwise issue a brand-new frontend-style credentials pair and
    // attempt to sync the email column too (best-effort UPDATE further down).
    : generateOwnerCredentials();

  const ok = await resetUserPasswordViaPg(user.id, fresh);
  if (!ok) {
    // Worst case (e.g. we lost DB connectivity between listUsers and here):
    // return the credentials anyway; printLocalStorageInjectCommand will
    // surface them and the user can decide whether to reset manually.
    console.warn('⚠️  Password reset did not match any row; persisted credentials may not log in.');
  }
  return fresh;
}

const _rawUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!_rawUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

// Normalize URL: host.docker.internal is a Docker-bridge DNS name that is
// NOT resolvable from the native Windows host shell. When the Supabase stack
// runs locally via supabase CLI (Docker Desktop), Kong exposes the REST API
// directly on localhost:54321. We rewrite the client URL so that @supabase/supabase-js
// (which uses fetch under the hood) can reach Kong without Docker networking.
const supabaseUrl = (() => {
  try {
    const u = new URL(_rawUrl);
    if (u.hostname === 'host.docker.internal') u.hostname = '127.0.0.1';
    return u.toString();
  } catch {
    return _rawUrl;
  }
})();

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Build a pg.Pool from the current environment.
 * Infers host from VITE_SUPABASE_URL; falls back to Supabase local defaults
 * (port=54322, user=postgres, db=postgres, password=postgres).
 * Override any with explicit DB_HOST / DB_PORT / DB_USER / DB_NAME / DB_PASSWORD.
 */
function buildPgPool(): Pool {
  let host = process.env.DB_HOST;
  if (!host) {
    try { host = new URL(supabaseUrl).hostname; } catch { host = '127.0.0.1'; }
  }
  // host.docker.internal is Docker-internal DNS — not resolvable from the Windows host shell.
  // When Supabase runs on the same machine via supabase CLI (Docker Desktop), the
  // Postgres port (default 54322) is exposed directly on localhost/127.0.0.1.
  if (host === 'host.docker.internal') host = '127.0.0.1';
  const port = parseInt(process.env.DB_PORT ?? '', 10) || 54322;
  const user = process.env.DB_USER || 'postgres';
  const database = process.env.DB_NAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  return new Pool({ host, port, user, database, password, ssl: false, connectionTimeoutMillis: 5000 });
}

function printTroubleshootingGuide(fetchHost: string) {
  console.log('');
  console.log('═════════════════════ Troubleshooting ═════════════════════');
  console.log(`  SUPABASE_URL used:   ${supabaseUrl}`);
  console.log(`  Host unreachable:    ${fetchHost}`);
  console.log('');
  console.log('  Most likely: the local Supabase stack is NOT RUNNING.');
  console.log('  Supabase CLI starts Kong (REST/entrypoint) / PostgREST / Auth / Postgres');
  console.log('  as Docker containers — after `supabase db reset` they may be stopped.');
  console.log('');
  console.log('  Run these commands in order:');
  console.log('    1. npm run db:local:status   # check containers running (DB URL / API URL)');
  console.log('    2. npm run db:local:start    # launch all local Supabase services');
  console.log('    3. Wait 15-30s until HEALTHY');
  console.log('    4. npm run db:seed           # retry the seed');
  console.log('');
  console.log('  If ports differ from Supabase local defaults, set in .env:');
  console.log('    DB_HOST / DB_PORT (default 54322)');
  console.log('    DB_PASSWORD (default postgres)');
  console.log('    VITE_SUPABASE_URL (e.g. http://127.0.0.1:<kong-port>)');
  console.log('═════════════════════════════════════════════════════════════');
}

async function listUsersViaPg(): Promise<Array<{ id: string; email?: string | null }>> {
  const pool = buildPgPool();
  try {
    const { rows } = await pool.query<{ id: string; email?: string | null }>(
      `SELECT id::text, email FROM auth.users ORDER BY created_at ASC LIMIT 10`,
    );
    return rows;
  } finally {
    await pool.end().catch(() => {});
  }
}

type GraphNode = { title: string; content: string; level: 'root' | 'core' | 'sub' | 'leaf'; x: number; y: number };
type GraphEdge = { source: string; target: string; type?: string };
type GraphData = {
  title: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const JAVASCRIPT_GRAPH: GraphData = {
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
};

const REACT_GRAPH: GraphData = {
  title: 'React 开发指南',
  description: 'React 框架的核心概念、组件设计、状态管理等知识点',
  nodes: [
    { title: 'React', content: 'React 是一个用于构建用户界面的 JavaScript 库，由 Facebook 开发维护。采用声明式编程、组件化思想和虚拟 DOM 技术。', level: 'root' as const, x: 400, y: 50 },
    { title: '组件', content: '组件是 React 的核心概念，分为函数组件和类组件。组件可以接收 props 并返回 JSX 描述 UI。', level: 'core' as const, x: 200, y: 180 },
    { title: '状态管理', content: 'React 提供多种状态管理方案：useState、useReducer、Context API，以及第三方库如 Redux、Zustand。', level: 'core' as const, x: 400, y: 180 },
    { title: 'Hooks', content: 'Hooks 是 React 16.8 引入的新特性，允许在函数组件中使用状态和其他 React 特性。', level: 'core' as const, x: 600, y: 180 },
    { title: '生命周期', content: '类组件有完整的生命周期方法：挂载、更新、卸载。函数组件使用 useEffect 模拟生命周期。', level: 'core' as const, x: 800, y: 180 },
    { title: '函数组件', content: '函数组件是简单的 JavaScript 函数，接收 props 返回 JSX。推荐使用函数组件和 Hooks。', level: 'sub' as const, x: 100, y: 320 },
    { title: '类组件', content: '类组件继承 React.Component，有 state 和生命周期方法。新项目建议使用函数组件。', level: 'sub' as const, x: 250, y: 320 },
    { title: 'Props', content: 'Props 是组件的输入参数，从父组件传递给子组件，是只读的。', level: 'sub' as const, x: 350, y: 320 },
    { title: 'useState', content: 'useState 是最基础的 Hook，用于在函数组件中添加状态。返回状态值和更新函数。', level: 'sub' as const, x: 450, y: 320 },
    { title: 'useEffect', content: 'useEffect 用于处理副作用，如数据获取、订阅、DOM 操作等。可以模拟类组件的生命周期。', level: 'sub' as const, x: 550, y: 320 },
    { title: 'useContext', content: 'useContext 用于消费 Context，避免 props drilling 问题。', level: 'sub' as const, x: 650, y: 320 },
    { title: 'useCallback', content: 'useCallback 返回一个记忆化的回调函数，用于优化性能，避免不必要的重新渲染。', level: 'sub' as const, x: 750, y: 320 },
    { title: 'useMemo', content: 'useMemo 返回一个记忆化的值，用于缓存计算结果，优化性能。', level: 'leaf' as const, x: 550, y: 450 },
    { title: '自定义 Hook', content: '自定义 Hook 是复用状态逻辑的方式，以 use 开头的函数。', level: 'leaf' as const, x: 650, y: 450 },
  ],
  edges: [
    { source: 'React', target: '组件' },
    { source: 'React', target: '状态管理' },
    { source: 'React', target: 'Hooks' },
    { source: 'React', target: '生命周期' },
    { source: '组件', target: '函数组件' },
    { source: '组件', target: '类组件' },
    { source: '组件', target: 'Props' },
    { source: '状态管理', target: 'useState' },
    { source: 'Hooks', target: 'useState' },
    { source: 'Hooks', target: 'useEffect' },
    { source: 'Hooks', target: 'useContext' },
    { source: 'Hooks', target: 'useCallback' },
    { source: '生命周期', target: 'useEffect', type: 'related' },
    { source: 'useCallback', target: 'useMemo', type: 'related' },
    { source: 'Hooks', target: '自定义 Hook' },
  ],
};

const PYTHON_GRAPH: GraphData = {
  title: 'Python 数据分析',
  description: '使用 Python 进行数据分析的完整知识体系，包括 NumPy、Pandas、Matplotlib 等',
  nodes: [
    { title: 'Python 数据分析', content: 'Python 是数据分析领域最流行的编程语言，拥有丰富的数据处理和可视化库。', level: 'root' as const, x: 400, y: 50 },
    { title: 'NumPy', content: 'NumPy 是 Python 科学计算的基础库，提供多维数组对象和数学运算函数。', level: 'core' as const, x: 200, y: 180 },
    { title: 'Pandas', content: 'Pandas 是数据分析的核心库，提供 DataFrame 和 Series 数据结构，支持数据清洗、转换、分析。', level: 'core' as const, x: 400, y: 180 },
    { title: 'Matplotlib', content: 'Matplotlib 是 Python 最基础的绑图库，支持各种静态、动态、交互式图表。', level: 'core' as const, x: 600, y: 180 },
    { title: '数据清洗', content: '数据清洗是数据分析的重要步骤，包括处理缺失值、重复值、异常值等。', level: 'core' as const, x: 800, y: 180 },
    { title: 'ndarray', content: 'ndarray 是 NumPy 的核心数据结构，N 维数组，支持向量化运算。', level: 'sub' as const, x: 100, y: 320 },
    { title: '数组运算', content: 'NumPy 支持广播机制、向量化运算、矩阵运算等高效数值计算。', level: 'sub' as const, x: 250, y: 320 },
    { title: 'DataFrame', content: 'DataFrame 是 Pandas 的核心数据结构，二维表格，类似 SQL 表或 Excel。', level: 'sub' as const, x: 350, y: 320 },
    { title: 'Series', content: 'Series 是一维标签数组，可以存储任意数据类型。', level: 'sub' as const, x: 450, y: 320 },
    { title: '数据聚合', content: 'Pandas 提供 groupby、pivot_table 等数据聚合功能。', level: 'sub' as const, x: 550, y: 320 },
    { title: '折线图', content: '折线图用于展示数据随时间变化的趋势。', level: 'sub' as const, x: 650, y: 320 },
    { title: '柱状图', content: '柱状图用于比较不同类别的数据大小。', level: 'sub' as const, x: 750, y: 320 },
    { title: '散点图', content: '散点图用于展示两个变量之间的关系。', level: 'leaf' as const, x: 650, y: 450 },
    { title: '缺失值处理', content: '处理缺失值的方法包括删除、填充、插值等。', level: 'leaf' as const, x: 750, y: 450 },
  ],
  edges: [
    { source: 'Python 数据分析', target: 'NumPy' },
    { source: 'Python 数据分析', target: 'Pandas' },
    { source: 'Python 数据分析', target: 'Matplotlib' },
    { source: 'Python 数据分析', target: '数据清洗' },
    { source: 'NumPy', target: 'ndarray' },
    { source: 'NumPy', target: '数组运算' },
    { source: 'Pandas', target: 'DataFrame' },
    { source: 'Pandas', target: 'Series' },
    { source: 'Pandas', target: '数据聚合' },
    { source: 'Matplotlib', target: '折线图' },
    { source: 'Matplotlib', target: '柱状图' },
    { source: 'Matplotlib', target: '散点图' },
    { source: '数据清洗', target: '缺失值处理' },
    { source: 'DataFrame', target: 'ndarray', type: 'related' },
  ],
};

const SINGLE_NODE_GRAPH: GraphData = {
  title: '单节点测试图谱',
  description: '用于测试单节点图谱边界条件',
  nodes: [
    { title: '唯一的节点', content: '这是单节点图谱中唯一的节点，用于测试边界条件。', level: 'root' as const, x: 400, y: 200 },
  ],
  edges: [],
};

const PERFORMANCE_GRAPH: GraphData = {
  title: '性能测试图谱',
  description: '包含大量节点的图谱，用于测试性能边界条件',
  nodes: (() => {
    const nodes: GraphNode[] = [];
    nodes.push({ title: '性能测试根节点', content: '这是性能测试图谱的根节点，用于测试大量数据渲染性能。', level: 'root', x: 500, y: 50 });
    
    for (let i = 1; i <= 10; i++) {
      nodes.push({ 
        title: `核心概念 ${i}`, 
        content: `这是第 ${i} 个核心概念节点，包含重要的知识点内容。`, 
        level: 'core', 
        x: 100 + (i - 1) * 90, 
        y: 150 
      });
    }
    
    for (let i = 1; i <= 20; i++) {
      nodes.push({ 
        title: `子节点 ${i}`, 
        content: `这是第 ${i} 个子节点，属于某个核心概念的延伸内容。`, 
        level: 'sub', 
        x: 50 + ((i - 1) % 10) * 100, 
        y: 280 + Math.floor((i - 1) / 10) * 80 
      });
    }
    
    for (let i = 1; i <= 20; i++) {
      nodes.push({ 
        title: `叶子节点 ${i}`, 
        content: `这是第 ${i} 个叶子节点，是最细粒度的知识点。`, 
        level: 'leaf', 
        x: 50 + ((i - 1) % 10) * 100, 
        y: 420 + Math.floor((i - 1) / 10) * 80 
      });
    }
    
    return nodes;
  })(),
  edges: (() => {
    const edges: GraphEdge[] = [];
    
    for (let i = 1; i <= 10; i++) {
      edges.push({ source: '性能测试根节点', target: `核心概念 ${i}` });
    }
    
    for (let i = 1; i <= 10; i++) {
      edges.push({ source: `核心概念 ${i}`, target: `子节点 ${i}` });
      edges.push({ source: `核心概念 ${i}`, target: `子节点 ${i + 10}` });
    }
    
    for (let i = 1; i <= 20; i++) {
      edges.push({ source: `子节点 ${i}`, target: `叶子节点 ${i}` });
    }
    
    return edges;
  })(),
};













const BOUNDARY_STUDY_CARDS = [
  { nodeTitle: '唯一的节点', question: '未学习卡片测试：这是未学习过的卡片问题？', answer: '这是未学习卡片的答案。', explanation: '此卡片 review_count = 0，用于测试未学习状态。', cardType: 'qa', difficulty: 2, reviewCount: 0, masteryLevel: 0 },
  { nodeTitle: 'let 和 const', question: '已掌握卡片测试：let 和 const 的主要区别是什么？', answer: 'let 声明可变变量，const 声明常量，两者都是块级作用域。', explanation: '此卡片 mastery_level >= 5, review_count >= 10，用于测试已掌握状态。', cardType: 'qa', difficulty: 2, reviewCount: 12, masteryLevel: 6 },
  { nodeTitle: 'var 关键字', question: '高难度卡片测试：var 关键字的变量提升机制是如何工作的？请详细解释。', answer: 'var 声明的变量会被提升到函数作用域顶部，但赋值不会提升。这意味着变量在声明前就可以访问，值为 undefined。', explanation: '此卡片 difficulty = 5，用于测试高难度卡片。', cardType: 'qa', difficulty: 5, reviewCount: 3, masteryLevel: 1 },
  { nodeTitle: '数据类型转换', question: '选择题测试：以下哪个方法可以将字符串转换为数字？', answer: 'Number()', explanation: 'Number()、parseInt()、parseFloat() 都可以转换，但 Number() 是最直接的。', cardType: 'choice', difficulty: 1, reviewCount: 2, masteryLevel: 2 },
  { nodeTitle: '箭头函数', question: '判断题测试：箭头函数有自己的 this 绑定。', answer: 'false', explanation: '箭头函数没有自己的 this，它会捕获定义时所在上下文的 this 值。', cardType: 'true_false', difficulty: 2, reviewCount: 4, masteryLevel: 3 },
  { nodeTitle: '闭包', question: '填空题测试：闭包是指函数能够访问其 ___ 作用域中的变量。', answer: '词法', explanation: '闭包让函数可以访问定义时的词法作用域，即使在作用域外执行。', cardType: 'fill_in_the_blank', difficulty: 3, reviewCount: 5, masteryLevel: 3 },
];

const STUDY_CARDS = [
  { nodeTitle: '函数', question: '什么是 JavaScript 中的闭包？请举例说明它的应用场景。', answer: '闭包是指函数能够访问其词法作用域外的变量，即使该函数在其原始作用域之外执行。', explanation: '闭包的核心概念是函数和其词法环境的组合。常见应用包括：数据私有化、函数工厂、模块模式。', cardType: 'qa', difficulty: 3 },
  { nodeTitle: 'Promise', question: 'Promise 有哪几种状态？状态之间如何转换？', answer: 'Promise 有三种状态：pending（进行中）、fulfilled（已成功）、rejected（已失败）。', explanation: '状态转换规则：pending 可以变为 fulfilled 或 rejected，状态一旦改变就不可逆。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'let 和 const', question: '以下哪个关键字声明的变量具有块级作用域？', answer: 'let', explanation: 'let 和 const 都是 ES6 引入的块级作用域变量声明方式。', cardType: 'choice', difficulty: 1 },
  { nodeTitle: 'ES6 Class', question: 'ES6 的 class 本质上是 JavaScript 原型继承的语法糖。', answer: 'true', explanation: 'class 语法并没有引入新的面向对象继承模型，它仍然是基于原型的继承。', cardType: 'true_false', difficulty: 2 },
  { nodeTitle: 'async/await', question: 'async 函数返回一个 ___ 对象，await 只能在 ___ 函数内部使用。', answer: 'Promise, async', explanation: 'async 函数总是返回一个 Promise 对象。', cardType: 'fill_in_the_blank', difficulty: 2 },
  { nodeTitle: 'useState', question: 'useState Hook 返回什么？', answer: 'useState 返回一个数组：当前状态值和更新状态的函数。', explanation: '可以通过数组解构获取：const [state, setState] = useState(initialValue)。', cardType: 'qa', difficulty: 1 },
  { nodeTitle: 'useEffect', question: 'useEffect 的第二个参数有什么作用？', answer: '第二个参数是依赖数组，控制 effect 的执行时机。空数组表示只在挂载时执行一次。', explanation: '不传第二个参数则每次渲染都执行，传入依赖项则只在依赖变化时执行。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'DataFrame', question: 'Pandas DataFrame 和 NumPy ndarray 的主要区别是什么？', answer: 'DataFrame 支持异构数据类型和标签索引，ndarray 只支持同构数据类型和数值索引。', explanation: 'DataFrame 更适合处理表格数据，ndarray 更适合数值计算。', cardType: 'qa', difficulty: 2 },
  { nodeTitle: 'NumPy', question: 'NumPy 的广播机制是什么？', answer: '广播机制允许不同形状的数组进行算术运算，自动扩展较小的数组。', explanation: '广播规则：从右向左比较维度，维度相等或其中一个为1时可以广播。', cardType: 'qa', difficulty: 3 },
];



async function createOwnerUserViaPg(
  credentials: OwnerCredentials = generateOwnerCredentials(),
): Promise<{ id: string; email: string; credentials: OwnerCredentials } | null> {
  /**
   * Creates the owner user directly via SQL INSERT into auth.users using Postgres
   * pgcrypto crypt(gen_salt('bf'), ...) — the same bcrypt hash used by Supabase
   * GoTrue. Useful as a last-resort fallback when the Auth Admin REST API is
   * unreachable (Kong not running after `supabase db reset`) but Postgres itself is.
   *
   * Accepts an explicit credentials argument so every caller (Auth Admin API vs
   * pure-SQL path, re-runs against .seed-owner-credentials.json) produces
   * accounts indistinguishable from frontend-generated `owner-<uuid>@local.app`
   * owners created by silentAuth.provisionOwner.
   */
  const { email: EMAIL, password: PLAIN_PASSWORD } = credentials;
  const pool = buildPgPool();
  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO auth.users (
         id, instance_id, email, encrypted_password, email_confirmed_at,
         invited_at, confirmation_token, confirmation_sent_at, recovery_token,
         recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
         raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
         created_at, updated_at, phone, phone_confirmed_at, phone_change,
         phone_change_token, phone_change_sent_at, email_change_token_current,
         email_change_confirm_status, banned_until, reauthentication_token,
         reauthentication_sent_at, is_sso_user, deleted_at
       ) VALUES (
         gen_random_uuid(),
         '00000000-0000-0000-0000-000000000000'::uuid,
         $1::text,
         crypt($2::text, gen_salt('bf')),
         NOW(),
         NULL, '', NULL, '', NULL, '', '', NULL,
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"name":"Owner"}'::jsonb,
         FALSE,
         'authenticated',
         'authenticated',
         NOW(), NOW(),
         NULL, NULL, '', '', NULL,
         '', 0, NULL, '', NULL,
         FALSE, NULL
       )
       ON CONFLICT (email) WHERE (is_sso_user = false) DO UPDATE SET
         updated_at = NOW(),
         email_confirmed_at = NOW(),
         encrypted_password = EXCLUDED.encrypted_password,
         raw_user_meta_data = '{"name":"Owner"}'::jsonb
       RETURNING id::text AS id`,
      [EMAIL, PLAIN_PASSWORD],
    );

    const userId = userResult.rows[0]?.id;
    if (!userId) return null;

    await client.query(
      `INSERT INTO auth.identities (
         id, provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at, email
       ) VALUES (
         gen_random_uuid(),
         $1::text,
         $2::uuid,
         jsonb_build_object('sub', $1::text, 'email', $3::text),
         'email',
         NOW(), NOW(), NOW(),
         $3::text
       )
       ON CONFLICT (provider, provider_id) DO NOTHING`,
      [userId, userId, EMAIL],
    ).catch(() => { /* identity row is optional — seed purpose only */ });

    return { id: userId, email: EMAIL, credentials };
  } catch (err) {
    console.warn('[seed_test_data] pg INSERT auth.users failed:', (err as Error).message);
    return null;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

async function getOwnerUser(): Promise<SeedOwnerUser> {
  console.log('🔧 Looking up owner user...');

  /** Wrap a raw user object + credentials into the SeedOwnerUser contract. */
  const finalize = async (
    user: { id: string; email?: string | null; role?: string; phone?: string | undefined; created_at?: string },
    credentials: OwnerCredentials,
  ): Promise<SeedOwnerUser> => {
    await persistSeedCredentials({ userId: user.id, email: credentials.email, password: credentials.password });
    return {
      id: user.id,
      email: user.email ?? credentials.email,
      role: user.role ?? '',
      phone: user.phone ?? undefined,
      created_at: user.created_at ?? '',
      credentials,
    };
  };

  // === Path 1: Supabase Auth Admin API (REST / Kong) ===
  try {
    const { data: existingUsers, error } = await supabase.auth.admin.listUsers();
    if (!error && existingUsers?.users?.length) {
      // Prefer frontend-created owner accounts (owner-<uuid>@local.app) so the
      // seed writes rows to the same user the app will sign into. Fall back to
      // users[0] if no match (e.g. a previous seed ran with the old format).
      const owner = existingUsers.users.find(u => u.email && /^owner-[0-9a-f-]{36}@local\.app$/i.test(u.email))
        ?? existingUsers.users[0];
      console.log('✅ Owner user found via Auth Admin API:', owner.id, `(${owner.email ?? 'no-email'})`);
      const credentials = await materializeCredentialsForExistingUser({ id: owner.id, email: owner.email ?? null });
      return finalize(owner, credentials);
    }
    // API reachable but empty → we can use createUser below
  } catch (err) {
    const msg = (err as Error).message || String(err);
    const isConnectError = /fetch failed|AuthRetryableFetchError|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg);
    if (!isConnectError) {
      console.error('❌ Error listing users (non-connect):', err);
      throw err;
    }
    console.warn('⚠️  Auth Admin API unreachable:', msg.trim().split('\n')[0]);
    console.warn('    Falling back to direct Postgres SQL query (auth.users table)...');

    // === Path 2: Direct Postgres (pg) list existing user ===
    try {
      const rows = await listUsersViaPg();
      if (rows.length > 0) {
        const owner = rows.find(r => r.email && /^owner-[0-9a-f-]{36}@local\.app$/i.test(r.email)) ?? rows[0];
        console.log(`✅ Owner user found via Postgres auth.users: ${owner.id} (${owner.email ?? 'no-email'})`);
        const credentials = await materializeCredentialsForExistingUser(owner);
        return finalize({ id: owner.id, email: owner.email ?? undefined, role: '', phone: undefined, created_at: '' }, credentials);
      }
      console.warn('    auth.users empty in Postgres; attempting SQL INSERT of demo owner...');
      const credentials = generateOwnerCredentials();
      const created = await createOwnerUserViaPg(credentials);
      if (created) {
        console.log(`✅ Owner user auto-created via Postgres SQL: ${created.id} (${created.email})`);
        return finalize({ id: created.id, email: created.email, role: '', phone: undefined, created_at: '' }, created.credentials);
      }
    } catch (pgErr) {
      console.error('❌ Postgres direct query also failed:', (pgErr as Error).message);
    }
    // === Both paths failed — give actionable diagnosis ===
    let fetchHost = '<unknown>';
    try {
      fetchHost = new URL(supabaseUrl).host;
    } catch {
      // URL parse failed — keep '<unknown>' default for diagnosis
    }
    printTroubleshootingGuide(fetchHost);
    process.exit(1);
  }

  // === Auth Admin API worked but returned EMPTY — auto-create the owner in place ===
  //   (Previously we exited here and forced the user to launch the frontend setup
  //    wizard. As a single-user dev tool we can just upsert the demo owner.)
  console.warn('⚠️  auth.users empty; auto-creating seed owner user via Auth Admin API...');

  const credentials = generateOwnerCredentials();
  try {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: credentials.email,
      password: credentials.password,
      email_confirm: true,
      user_metadata: { name: 'Owner' },
    });
    if (createErr || !created?.user) {
      throw createErr ?? new Error('Auth admin createUser returned empty user');
    }
    console.log(`✅ Owner user auto-created: ${created.user.id} (${created.user.email})`);
    return finalize(created.user, credentials);
  } catch (createErr) {
    console.error('❌ Auth admin API createUser also failed; attempting SQL INSERT as final fallback...', (createErr as Error).message);
    const sqlCreated = await createOwnerUserViaPg(credentials);
    if (sqlCreated) {
      console.log(`✅ Owner user auto-created via Postgres SQL fallback: ${sqlCreated.id} (${sqlCreated.email})`);
      return finalize(
        { id: sqlCreated.id, email: sqlCreated.email, role: '', phone: undefined, created_at: '' },
        sqlCreated.credentials,
      );
    }
  }

  console.error(
    '❌ No user found AND auto-creation also failed. Launch the app once first — ' +
    'it auto-creates the owner user on first setup, then re-run this script.',
  );
  process.exit(1);
}

async function updateUserProfile(userId: string) {
  console.log('🔧 Updating user profile...');
  
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'premium',
      xp: 2500,
      level: 8,
      settings: { theme: 'dark', language: 'zh-CN', notifications: true },
    })
    .eq('id', userId);
  
  if (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
  
  console.log('✅ User profile updated');
}

async function createKnowledgeGraphWithData(userId: string, graphData: GraphData) {
  console.log(`🔧 Creating graph "${graphData.title}"...`);
  
  const { data: existing } = await supabase
    .from('knowledge_graphs')
    .select('id')
    .eq('user_id', userId)
    .eq('title', graphData.title)
    .single();
  
  if (existing) {
    console.log(`  ⏭️  Graph "${graphData.title}" already exists`);
    
    const { data: existingKnowledgePoints } = await supabase
      .from('graph_nodes')
      .select('knowledge_point_id, knowledge_points(title)')
      .eq('graph_id', existing.id);
    
    const nodeMap: Record<string, string> = {};
    for (const gn of existingKnowledgePoints || []) {
      const kp = gn.knowledge_points as unknown as { title: string }[] | null;
      if (kp && kp.length > 0) {
        nodeMap[kp[0].title] = gn.knowledge_point_id;
      }
    }
    
    return { graphId: existing.id, nodeMap };
  }
  
  const { data: graph, error: graphError } = await supabase
    .from('knowledge_graphs')
    .insert({
      user_id: userId,
      title: graphData.title,
      description: graphData.description,
      is_public: true,
      is_favorite: graphData.title === 'JavaScript 基础知识',
      settings: { layout: 'force-directed', theme: 'default' },
    })
    .select('id')
    .single();
  
  if (graphError || !graph) {
    console.error(`  ❌ Error creating graph:`, graphError);
    return null;
  }
  
  console.log(`  ✅ Graph "${graphData.title}" created`);
  
  const knowledgePointMap: Record<string, string> = {};
  
  for (const node of graphData.nodes) {
    const { data, error } = await supabase
      .from('knowledge_points')
      .insert({
        title: node.title,
        content: node.content,
        owner_id: userId,
        visibility: 'private',
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating knowledge point "${node.title}":`, error);
      continue;
    }
    
    knowledgePointMap[node.title] = data.id;
    
    await supabase
      .from('graph_nodes')
      .insert({
        graph_id: graph.id,
        knowledge_point_id: data.id,
        level: node.level,
        x_position: node.x,
        y_position: node.y,
        is_accepted: true,
      });
  }
  
  for (const edge of graphData.edges) {
    const sourceKPId = knowledgePointMap[edge.source];
    const targetKPId = knowledgePointMap[edge.target];
    
    if (!sourceKPId || !targetKPId) continue;
    
    await supabase
      .from('edges')
      .insert({
        graph_id: graph.id,
        source_knowledge_point_id: sourceKPId,
        target_knowledge_point_id: targetKPId,
        relationship_type: edge.type || 'contains',
        weight: edge.type === 'related' ? 2 : 1,
      });
  }
  
  console.log(`  ✅ Nodes and edges created for "${graphData.title}"`);
  
  return { graphId: graph.id, nodeMap: knowledgePointMap };
}

async function createStudyCardsForGraph(userId: string, graphId: string, nodeMap: Record<string, string>, graphTitle: string) {
  console.log(`🔧 Creating study cards for "${graphTitle}"...`);
  
  const relevantCards = STUDY_CARDS.filter(card => {
    const nodeTitle = card.nodeTitle;
    return nodeMap[nodeTitle];
  });
  
  for (const card of relevantCards) {
    const knowledgePointId = nodeMap[card.nodeTitle];
    if (!knowledgePointId) continue;
    
    const focusTopic = card.question.length > 24
      ? `${card.question.slice(0, 24)  }…`
      : card.question;
    
    const { error } = await supabase
      .from('study_cards')
      .insert({
        knowledge_point_id: knowledgePointId,
        user_id: userId,
        graph_id: graphId,
        source_graph_id: graphId,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.cardType,
        difficulty: card.difficulty,
        review_count: Math.floor(Math.random() * 5),
        focus_topic: focusTopic,
      });
    
    if (!error) {
      console.log(`  ✅ Study card for "${card.nodeTitle}" created`);
    }
  }
}

async function createBoundaryStudyCards(userId: string, allNodeMaps: Record<string, Record<string, string>>) {
  console.log('🔧 Creating boundary study cards...');
  
  for (const card of BOUNDARY_STUDY_CARDS) {
    let knowledgePointId: string | undefined;
    let graphId: string | undefined;
    
    for (const [, nodeMap] of Object.entries(allNodeMaps)) {
      if (nodeMap[card.nodeTitle]) {
        knowledgePointId = nodeMap[card.nodeTitle];
        graphId = nodeMap.__graphId;
        break;
      }
    }
    
    if (!knowledgePointId || !graphId) {
      console.log(`  ⏭️  Skipping card for "${card.nodeTitle}" - node not found`);
      continue;
    }
    
    const focusTopic = card.question.length > 24
      ? `${card.question.slice(0, 24)  }…`
      : card.question;
    
    const { error } = await supabase
      .from('study_cards')
      .insert({
        knowledge_point_id: knowledgePointId,
        user_id: userId,
        graph_id: graphId,
        source_graph_id: graphId,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.cardType,
        difficulty: card.difficulty,
        review_count: card.reviewCount,
        mastery_level: card.masteryLevel,
        focus_topic: focusTopic,
      });
    
    if (!error) {
      console.log(`  ✅ Boundary study card for "${card.nodeTitle}" created (review_count=${card.reviewCount}, mastery_level=${card.masteryLevel})`);
    }
  }
}

async function createStudyProgress(userId: string, graphId: string, totalNodes: number) {
  const masteredNodes = Math.floor(totalNodes * 0.4);
  
  await supabase
    .from('study_progress')
    .upsert({
      user_id: userId,
      graph_id: graphId,
      total_nodes: totalNodes,
      mastered_nodes: masteredNodes,
      progress_percentage: (masteredNodes / totalNodes) * 100,
      study_streak: Math.floor(Math.random() * 7) + 1,
    }, { onConflict: 'user_id,graph_id' });
}

async function createIsolatedNodes(userId: string, graphId: string) {
  console.log('🔧 Creating isolated nodes...');
  
  const isolatedNodes = [
    { title: '孤立节点1', content: '这是一个没有连接边的孤立节点，用于测试边界条件。', level: 'sub' as const, x: 50, y: 500 },
    { title: '孤立节点2', content: '这是另一个没有连接边的孤立节点。', level: 'leaf' as const, x: 200, y: 500 },
    { title: '孤立节点3', content: '第三个孤立节点，用于测试孤立节点的显示和处理。', level: 'leaf' as const, x: 350, y: 500 },
  ];
  
  for (const node of isolatedNodes) {
    const { data, error } = await supabase
      .from('knowledge_points')
      .insert({
        title: node.title,
        content: node.content,
        owner_id: userId,
        visibility: 'private',
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`  ❌ Error creating isolated node "${node.title}":`, error);
      continue;
    }
    
    await supabase
      .from('graph_nodes')
      .insert({
        graph_id: graphId,
        knowledge_point_id: data.id,
        level: node.level,
        x_position: node.x,
        y_position: node.y,
        is_accepted: true,
      });
    
    console.log(`  ✅ Isolated node "${node.title}" created`);
  }
}

async function createScheduledTasks(userId: string) {
  console.log('🔧 Creating scheduled tasks...');
  
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  
  const tasks = [
    { title: '完成 JavaScript 异步编程学习', queueLevel: 0, position: 0, status: 'pending', estimatedDuration: 45, tags: ['学习', 'JavaScript'], priority: 'high' },
    { title: '复习 React Hooks', queueLevel: 0, position: 1, status: 'pending', estimatedDuration: 30, tags: ['学习', 'React'], priority: 'medium' },
    { title: '完成项目文档', queueLevel: 1, position: 0, status: 'pending', estimatedDuration: 60, tags: ['工作', '文档'], priority: 'high' },
    { title: '代码审查', queueLevel: 1, position: 1, status: 'in_progress', estimatedDuration: 30, tags: ['工作', '代码'], priority: 'medium' },
    { title: '学习 Pandas 数据处理', queueLevel: 1, position: 2, status: 'pending', estimatedDuration: 40, tags: ['学习', 'Python'], priority: 'low' },
    { title: '整理学习笔记', queueLevel: 2, position: 0, status: 'pending', estimatedDuration: 20, tags: ['学习', '笔记'], priority: 'low' },
    { title: '阅读技术文章', queueLevel: 2, position: 1, status: 'pending', estimatedDuration: 15, tags: ['学习', '阅读'], priority: 'low' },
    { title: '更新知识图谱', queueLevel: 2, position: 2, status: 'pending', estimatedDuration: 25, tags: ['学习', '知识管理'], priority: 'medium' },
    { title: '[边界测试] 过期任务-一周前创建', queueLevel: 0, position: 2, status: 'pending', estimatedDuration: 30, tags: ['测试', '过期'], createdAt: oneWeekAgo, priority: 'high' },
    { title: '[边界测试] 已完成任务1', queueLevel: 0, position: 3, status: 'completed', estimatedDuration: 45, tags: ['测试', '已完成'], priority: 'medium' },
    { title: '[边界测试] 已完成任务2', queueLevel: 1, position: 3, status: 'completed', estimatedDuration: 30, tags: ['测试', '已完成'], priority: 'low' },
    { title: '[边界测试] 已完成任务3', queueLevel: 2, position: 3, status: 'completed', estimatedDuration: 20, tags: ['测试', '已完成'], priority: 'low' },
    { title: '学习机器学习基础', queueLevel: 0, position: 4, status: 'pending', estimatedDuration: 90, tags: ['学习', '机器学习', 'AI'], priority: 'high' },
    { title: '完成英语听力练习', queueLevel: 0, position: 5, status: 'pending', estimatedDuration: 30, tags: ['学习', '英语', '听力'], priority: 'medium' },
    { title: '复习数学微积分', queueLevel: 1, position: 4, status: 'pending', estimatedDuration: 60, tags: ['学习', '数学'], priority: 'medium' },
    { title: '准备周报', queueLevel: 1, position: 5, status: 'pending', estimatedDuration: 20, tags: ['工作', '报告'], priority: 'high' },
    { title: '参加团队会议', queueLevel: 0, position: 6, status: 'pending', estimatedDuration: 60, tags: ['工作', '会议'], priority: 'high' },
    { title: '学习 TypeScript 高级特性', queueLevel: 1, position: 6, status: 'pending', estimatedDuration: 45, tags: ['学习', 'TypeScript'], priority: 'medium' },
    { title: '优化代码性能', queueLevel: 1, position: 7, status: 'pending', estimatedDuration: 120, tags: ['工作', '性能优化'], priority: 'high' },
    { title: '学习 Docker 容器化', queueLevel: 2, position: 4, status: 'pending', estimatedDuration: 60, tags: ['学习', 'DevOps', 'Docker'], priority: 'low' },
    { title: '整理项目依赖', queueLevel: 2, position: 5, status: 'pending', estimatedDuration: 30, tags: ['工作', '维护'], priority: 'low' },
    { title: '学习 GraphQL API', queueLevel: 2, position: 6, status: 'pending', estimatedDuration: 45, tags: ['学习', 'API', 'GraphQL'], priority: 'medium' },
    { title: '[边界测试] 高优先级紧急任务', queueLevel: 0, position: 7, status: 'pending', estimatedDuration: 15, tags: ['测试', '紧急'], priority: 'high', createdAt: twoDaysAgo },
    { title: '[边界测试] 长时间任务', queueLevel: 1, position: 8, status: 'pending', estimatedDuration: 180, tags: ['测试', '长时间'], priority: 'medium' },
    { title: '[边界测试] 短时间任务', queueLevel: 2, position: 7, status: 'pending', estimatedDuration: 5, tags: ['测试', '短时间'], priority: 'low' },
  ];
  
  const q2Tasks = [
    { title: 'Q2任务1-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务2-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务3-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务4-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务5-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务6-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务7-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务8-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务9-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务10-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务11-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
    { title: 'Q2任务12-满载队列测试', queueLevel: 2, status: 'pending', estimatedDuration: 15, tags: ['测试', '满载'], priority: 'low' },
  ];
  
  let q2Position = 8;
  for (const q2Task of q2Tasks) {
    tasks.push({ ...q2Task, position: q2Position++ });
  }
  
  for (const task of tasks) {
    const insertData: Record<string, unknown> = {
      user_id: userId,
      title: task.title,
      queue_level: task.queueLevel,
      position: task.position,
      status: task.status,
      estimated_duration: task.estimatedDuration,
      tags: task.tags,
      priority: task.priority || 'medium',
    };
    
    if (task.createdAt) {
      insertData.created_at = task.createdAt;
    }
    
    const { error } = await supabase
      .from('user_tasks')
      .insert(insertData);
    
    if (!error) {
      console.log(`  ✅ Task "${task.title}" created (Q${task.queueLevel}, ${task.priority || 'medium'})`);
    }
  }
}

async function createTaskExecutions(userId: string) {
  console.log('🔧 Creating task execution history...');
  
  const executions = [
    { startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), duration: 1800, status: 'completed', queueLevel: 0 },
    { startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), duration: 2700, status: 'completed', queueLevel: 1 },
    { startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 1500, status: 'completed', queueLevel: 0 },
    { startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), duration: 900, status: 'interrupted', queueLevel: 1 },
    { startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), duration: 3600, status: 'completed', queueLevel: 0 },
  ];
  
  const { data: tasks } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .limit(5);
  
  if (!tasks || tasks.length === 0) return;
  
  for (let i = 0; i < executions.length && i < tasks.length; i++) {
    const exec = executions[i];
    const endedAt = new Date(exec.startedAt.getTime() + exec.duration * 1000);
    
    await supabase
      .from('task_executions')
      .insert({
        task_id: tasks[i].id,
        user_id: userId,
        started_at: exec.startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration: exec.duration,
        status: exec.status,
        queue_level: exec.queueLevel,
      });
    
    console.log(`  ✅ Task execution created (${exec.status})`);
  }
}

async function createFocusSessions(userId: string) {
  console.log('🔧 Creating focus sessions...');
  
  const sessions = [
    { start: '30 minutes', duration: 25, mode: 'focus', pomodoroCount: 1 },
    { start: '2 hours', duration: 50, mode: 'focus', pomodoroCount: 2 },
    { start: '1 day', duration: 30, mode: 'focus', pomodoroCount: 1 },
    { start: '2 days', duration: 45, mode: 'focus', pomodoroCount: 2 },
    { start: '3 days', duration: 25, mode: 'focus', pomodoroCount: 1 },
    { start: '1 week', duration: 60, mode: 'focus', pomodoroCount: 3 },
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
        mode: session.mode,
        completed: true,
        pomodoro_count: session.pomodoroCount,
      });
    
    if (!error) {
      console.log(`  ✅ Focus session created (${session.start} ago, ${session.duration}min)`);
    }
  }
}

async function createDailyTasks(userId: string) {
  console.log('🔧 Creating daily tasks...');
  
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const tasks = [
    { date: today, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: today, type: 'focus_time', status: 'in_progress', progress: 20, target: 30, xp: 30 },
    { date: yesterday, type: 'study_cards', status: 'completed', progress: 5, target: 5, xp: 50 },
    { date: yesterday, type: 'focus_time', status: 'completed', progress: 30, target: 30, xp: 30 },
    { date: twoDaysAgo, type: 'study_cards', status: 'completed', progress: 4, target: 5, xp: 40 },
    { date: twoDaysAgo, type: 'focus_time', status: 'completed', progress: 25, target: 30, xp: 25 },
  ];
  
  for (const task of tasks) {
    await supabase
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
    
    console.log(`  ✅ Task "${task.type}" for ${task.date} created`);
  }
}

async function createPeriodicTasksAndPass(userId: string) {
  console.log('🔧 Creating periodic tasks and pass progress...');
  
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  
  const periodicTasks = [
    { periodType: 'weekly', periodStart: weekStartStr, taskType: 'focus', target: 7, progress: 5, xpReward: 100 },
    { periodType: 'weekly', periodStart: weekStartStr, taskType: 'study', target: 5, progress: 3, xpReward: 80 },
    { periodType: 'monthly', periodStart: monthStartStr, taskType: 'focus', target: 30, progress: 15, xpReward: 300 },
    { periodType: 'monthly', periodStart: monthStartStr, taskType: 'study', target: 20, progress: 10, xpReward: 200 },
  ];
  
  for (const task of periodicTasks) {
    await supabase
      .from('periodic_tasks')
      .insert({
        user_id: userId,
        period_type: task.periodType,
        period_start: task.periodStart,
        period_end: task.periodType === 'weekly' 
          ? new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().split('T')[0],
        task_type: task.taskType,
        target: task.target,
        progress: task.progress,
        status: task.progress >= task.target ? 'completed' : 'pending',
        xp_reward: task.xpReward,
      });
    
    console.log(`  ✅ Periodic task ${task.periodType}/${task.taskType} created`);
  }
  
  await supabase
    .from('periodic_passes')
    .insert({
      user_id: userId,
      period_type: 'weekly',
      period_start: weekStartStr,
      period_end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_points: 80,
      current_level: 3,
    });
  
  await supabase
    .from('periodic_passes')
    .insert({
      user_id: userId,
      period_type: 'monthly',
      period_start: monthStartStr,
      period_end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().split('T')[0],
      total_points: 250,
      current_level: 5,
    });
  
  console.log('  ✅ Periodic passes created');
}

async function unlockAchievements(userId: string) {
  console.log('🔧 Unlocking achievements...');
  
  const achievementCodes = [
    'streak_3', 'streak_7',
    'focus_10', 'focus_60',
    'mastery_1', 'mastery_10',
    'creation_graph_1', 'creation_graph_5',
    'creation_node_10', 'creation_node_100',
    'first_focus', 'pomodoro_10',
    'tasks_10', 'daily_streak_7',
  ];
  
  const { data: achievements } = await supabase
    .from('achievements')
    .select('id, code')
    .in('code', achievementCodes);
  
  if (!achievements || achievements.length === 0) {
    console.log('  ⏭️  No achievements found');
    return;
  }
  
  for (const achievement of achievements) {
    const daysAgo = Math.floor(Math.random() * 14) + 1;
    const unlockedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievement.id,
        unlocked_at: unlockedAt.toISOString(),
        progress: 100,
      }, { onConflict: 'user_id,achievement_id' });
    
    console.log(`  ✅ Achievement "${achievement.code}" unlocked`);
  }
}

async function createUserFocusStats(userId: string) {
  console.log('🔧 Creating user focus stats...');
  
  await supabase
    .from('user_focus_stats')
    .upsert({
      user_id: userId,
      total_focus_seconds: 36000,
      total_sessions: 25,
      total_pomodoros: 45,
      total_tasks_completed: 30,
      current_streak: 7,
      longest_streak: 14,
      weekly_streak: 2,
      monthly_streak: 1,
      daily_task_streak: 5,
      last_daily_completion: new Date().toISOString().split('T')[0],
      last_focus_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id' });
  
  console.log('  ✅ User focus stats created');
}

function parseTimeOffset(offset: string): number {
  const match = offset.match(/^(\d+)\s*(minute|hour|day|week|month)s?$/i);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'minute': return value * 60 * 1000;
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
    const user = await getOwnerUser();
    await updateUserProfile(user.id);
    
    const jsResult = await createKnowledgeGraphWithData(user.id, JAVASCRIPT_GRAPH);
    const reactResult = await createKnowledgeGraphWithData(user.id, REACT_GRAPH);
    const pythonResult = await createKnowledgeGraphWithData(user.id, PYTHON_GRAPH);
    
    const singleNodeResult = await createKnowledgeGraphWithData(user.id, SINGLE_NODE_GRAPH);
    const performanceResult = await createKnowledgeGraphWithData(user.id, PERFORMANCE_GRAPH);
    
    if (jsResult) {
      await createStudyCardsForGraph(user.id, jsResult.graphId, jsResult.nodeMap, 'JavaScript 基础知识');
      await createStudyProgress(user.id, jsResult.graphId, JAVASCRIPT_GRAPH.nodes.length);
      await createIsolatedNodes(user.id, jsResult.graphId);
    }
    if (reactResult) {
      await createStudyCardsForGraph(user.id, reactResult.graphId, reactResult.nodeMap, 'React 开发指南');
      await createStudyProgress(user.id, reactResult.graphId, REACT_GRAPH.nodes.length);
    }
    if (pythonResult) {
      await createStudyCardsForGraph(user.id, pythonResult.graphId, pythonResult.nodeMap, 'Python 数据分析');
      await createStudyProgress(user.id, pythonResult.graphId, PYTHON_GRAPH.nodes.length);
    }
    if (singleNodeResult) {
      await createStudyProgress(user.id, singleNodeResult.graphId, SINGLE_NODE_GRAPH.nodes.length);
    }
    if (performanceResult) {
      await createStudyProgress(user.id, performanceResult.graphId, PERFORMANCE_GRAPH.nodes.length);
    }
    
    const allNodeMaps: Record<string, Record<string, string>> = {};
    if (jsResult) {
      jsResult.nodeMap.__graphId = jsResult.graphId;
      allNodeMaps['JavaScript'] = jsResult.nodeMap;
    }
    if (reactResult) {
      reactResult.nodeMap.__graphId = reactResult.graphId;
      allNodeMaps['React'] = reactResult.nodeMap;
    }
    if (singleNodeResult) {
      singleNodeResult.nodeMap.__graphId = singleNodeResult.graphId;
      allNodeMaps['SingleNode'] = singleNodeResult.nodeMap;
    }
    
    await createBoundaryStudyCards(user.id, allNodeMaps);
    
    await createScheduledTasks(user.id);
    await createTaskExecutions(user.id);
    await createFocusSessions(user.id);
    await createDailyTasks(user.id);
    await createPeriodicTasksAndPass(user.id);
    await unlockAchievements(user.id);
    await createUserFocusStats(user.id);
    
    console.log('\n✅ Test data seed completed!');
    console.log(`\n📋 Seeded into owner user: ${user.id} (${user.email ?? 'no-email'})`);
    printLocalStorageInjectCommand(user.credentials);
    console.log(`  Credentials file saved to: ${CREDENTIALS_OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

main();
