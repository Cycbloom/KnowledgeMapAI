#!/usr/bin/env node
/**
 * 环境变量校验脚本
 *
 * 校验 .env.development 中必填环境变量的完整性：
 * 1. 优先读取 .env.development，回退到 .env.example
 * 2. 校验必填变量：存在性、非空、非占位符
 * 3. 输出报告到 stdout
 *
 * 用法: node scripts/check-env.mjs
 *
 * 退出码：
 *   0 - 所有必填变量通过
 *   1 - 有必填变量缺失或为占位符
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const DEV_ENV_PATH = join(projectRoot, ".env.development");
const EXAMPLE_ENV_PATH = join(projectRoot, ".env.example");

/** 显示时变量名的对齐宽度 */
const KEY_PAD_WIDTH = 32;

/**
 * 解析 .env 文件内容为 key-value 对象
 * 支持带引号值、# 注释、export 前缀
 * @param {string} content
 * @returns {Record<string, string>}
 */
function parseEnvFile(content) {
  /** @type {Record<string, string>} */
  const env = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // 移除 export 前缀
    const withoutExport = trimmed.replace(/^export\s+/, "");
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex === -1) continue;
    const key = withoutExport.slice(0, eqIndex).trim();
    if (!key) continue;
    let value = withoutExport.slice(eqIndex + 1).trim();
    // 处理引号包裹的值
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      // 未加引号的值：移除行内注释（# 前必须有空格）
      const commentMatch = value.match(/\s+#.*$/);
      if (commentMatch && commentMatch.index !== undefined) {
        value = value.slice(0, commentMatch.index).trim();
      }
    }
    env[key] = value;
  }
  return env;
}

/**
 * 判断值是否为占位符
 * 占位符特征：以 your_、your-、xxx、example、< 等开头，或包含典型占位符短语
 * @param {string} value
 * @returns {boolean}
 */
function isPlaceholder(value) {
  if (!value) return false;
  const lower = value.toLowerCase();
  // 以占位符标记开头
  if (
    /^(your_|your-|xxx|example|placeholder|change_me|replace_me|<)/.test(lower)
  ) {
    return true;
  }
  // 包含典型占位符短语
  if (
    lower.includes("your_") ||
    lower.includes("your-") ||
    lower.includes("change_me") ||
    lower.includes("replace_me") ||
    lower.includes("_here") ||
    lower.includes("placeholder")
  ) {
    return true;
  }
  // 以 < 开头 > 结尾（如 <your-key>）
  if (/^<.*>$/.test(value)) return true;
  return false;
}

/**
 * 判断变量的值是否应该被遮掩（含敏感关键词）
 * @param {string} key
 * @returns {boolean}
 */
function shouldMask(key) {
  const upper = key.toUpperCase();
  return (
    upper.includes("KEY") ||
    upper.includes("SECRET") ||
    upper.includes("PASSWORD") ||
    upper.includes("TOKEN")
  );
}

/**
 * 格式化变量值用于显示
 * @param {string} key
 * @param {string | undefined} value
 * @returns {string}
 */
function formatValue(key, value) {
  if (value === undefined || value === "") return "[缺失]";
  if (shouldMask(key)) return "[已配置]";
  return value;
}

/**
 * 必填变量检查项（支持多选一）
 * @typedef {Object} RequiredCheck
 * @property {string} label - 显示名称（用于组检查的错误展示）
 * @property {string[]} keys - 可选 key 列表（任一满足即可）
 * @property {string} purpose - 用途说明
 * @property {string} howto - 获取方式
 */

/** @type {RequiredCheck[]} */
const requiredChecks = [
  {
    label: "Supabase URL",
    keys: ["SUPABASE_URL", "VITE_SUPABASE_URL"],
    purpose: "Supabase 项目 URL",
    howto:
      "本地开发：执行 npm run db:local:start 后使用 http://127.0.0.1:54321；生产环境：Supabase Dashboard > Project Settings > API",
  },
  {
    label: "Supabase Service Role Key",
    keys: ["SUPABASE_SERVICE_ROLE_KEY"],
    purpose: "Supabase 服务端密钥（仅服务端使用，禁止暴露到前端）",
    howto:
      "Supabase Dashboard > Project Settings > API > Project API keys；本地开发：npm run db:local:start 后从 supabase status 输出获取",
  },
  {
    label: "Supabase Anon Key",
    keys: ["VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
    purpose: "Supabase 公共匿名密钥（前端可暴露）",
    howto:
      "Supabase Dashboard > Project Settings > API > Project API keys；本地开发：npm run db:local:start 后从 supabase status 输出获取",
  },
  {
    label: "Supabase JWT Secret",
    keys: ["SUPABASE_JWT_SECRET", "JWT_SECRET"],
    purpose: "Supabase JWT 验证密钥（用于 requireAuth 中间件本地校验）",
    howto:
      "本地开发：npm run db:local:start 后从 supabase status 输出中获取（默认 super-secret-jwt-token-with-at-least-32-characters-long）；生产环境：Supabase Dashboard > Project Settings > API > JWT Settings",
  },
  {
    label: "AI Provider API Key",
    keys: ["DEEPSEEK_API_KEY", "VOLCENGINE_API_KEY", "ALIYUN_API_KEY"],
    purpose: "AI 服务密钥（至少配置一个以启用 AI 功能）",
    howto:
      "DeepSeek: https://platform.deepseek.com/；火山引擎: https://www.volcengine.com/；阿里云 DashScope: https://dashscope.aliyun.com/",
  },
];

/**
 * 可选变量清单
 * @typedef {Object} OptionalVar
 * @property {string} key
 * @property {string} purpose
 */

/** @type {OptionalVar[]} */
const optionalVars = [
  { key: "DEEPSEEK_API_KEY", purpose: "DeepSeek API 密钥" },
  { key: "VITE_DEEPSEEK_API_KEY", purpose: "DeepSeek API 密钥（移动端）" },
  { key: "VOLCENGINE_API_KEY", purpose: "火山引擎 API 密钥" },
  { key: "VITE_VOLCENGINE_API_KEY", purpose: "火山引擎 API 密钥（移动端）" },
  { key: "ALIYUN_API_KEY", purpose: "阿里云 API 密钥" },
  { key: "VITE_ALIYUN_API_KEY", purpose: "阿里云 API 密钥（移动端）" },
  { key: "ALIYUN_BASE_URL", purpose: "阿里云 MaaS 自定义 Base URL" },
  { key: "DATABASE_URL", purpose: "PostgreSQL 直连字符串" },
  { key: "REDIS_URL", purpose: "Redis 连接字符串" },
  { key: "CACHE_BACKEND", purpose: "缓存后端（memory/redis）" },
  { key: "RATE_LIMIT_STORE", purpose: "限流存储后端（memory/redis）" },
  { key: "EVENT_BUS_BACKEND", purpose: "事件总线后端（memory/redis）" },
  { key: "PORT", purpose: "API 服务端口" },
  { key: "FRONTEND_URL", purpose: "前端 URL（CORS 白名单）" },
  { key: "NODE_ENV", purpose: "Node 运行环境" },
  { key: "VITE_API_BASE_URL", purpose: "移动端 API 基础 URL" },
  {
    key: "VITE_MOBILE_USE_SUPABASE_DIRECT",
    purpose: "移动端是否直连 Supabase",
  },
  { key: "TEST_USER_EMAIL", purpose: "E2E 测试用户邮箱" },
  { key: "TEST_USER_PASSWORD", purpose: "E2E 测试用户密码" },
  { key: "VITE_DEV_TEST_PASSWORD", purpose: "开发环境自动登录测试密码" },
  { key: "DISABLE_RATE_LIMIT", purpose: "是否禁用限流" },
  { key: "CONCEPT_MERGE_THRESHOLD", purpose: "概念合并相似度阈值" },
  {
    key: "CONCEPT_BATCH_MERGE_THRESHOLD",
    purpose: "批内概念合并相似度阈值",
  },
  {
    key: "CONCEPT_FUZZY_TITLE_THRESHOLD",
    purpose: "模糊标题匹配确认阈值",
  },
];

/**
 * 在 env 中查找满足条件的 key（存在、非空、非占位符）
 * @param {Record<string, string>} env
 * @param {string[]} keys
 * @returns {{ key: string, value: string } | null}
 */
function findSatisfiedKey(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (value && !isPlaceholder(value)) {
      return { key, value };
    }
  }
  return null;
}

/**
 * 在 env 中查找占位符 key（存在但为占位符）
 * @param {Record<string, string>} env
 * @param {string[]} keys
 * @returns {{ key: string, value: string } | null}
 */
function findPlaceholderKey(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (value && isPlaceholder(value)) {
      return { key, value };
    }
  }
  return null;
}

// --- Main ---
console.log("🔍 环境变量校验报告");
console.log("");

// 1. 选择读取文件
let envPath = "";
let envContent = "";
let usingFallback = false;

if (existsSync(DEV_ENV_PATH)) {
  envPath = DEV_ENV_PATH;
  envContent = readFileSync(DEV_ENV_PATH, "utf-8");
} else if (existsSync(EXAMPLE_ENV_PATH)) {
  envPath = EXAMPLE_ENV_PATH;
  envContent = readFileSync(EXAMPLE_ENV_PATH, "utf-8");
  usingFallback = true;
} else {
  console.log("❌ 未找到 .env.development 或 .env.example 文件");
  console.log("");
  console.log("💡 建议：复制 .env.example 为 .env.development 并填入实际值");
  process.exit(1);
}

const relativePath = relative(projectRoot, envPath);
if (usingFallback) {
  console.log(
    `📄 读取文件: ${relativePath}（回退到示例文件，建议复制为 .env.development 并填入实际值）`,
  );
} else {
  console.log(`📄 读取文件: ${relativePath}`);
}
console.log("");

const env = parseEnvFile(envContent);

// 2. 校验必填变量
let passCount = 0;
let warnCount = 0;
let errorCount = 0;

/** @type {{ check: RequiredCheck, satisfied: { key: string, value: string } }[]} */
const requiredPassed = [];
/** @type {{ check: RequiredCheck, kind: "missing" | "placeholder", foundKey?: string, foundValue?: string }[]} */
const requiredFailed = [];

for (const check of requiredChecks) {
  const satisfied = findSatisfiedKey(env, check.keys);
  if (satisfied) {
    requiredPassed.push({ check, satisfied });
  } else {
    const placeholder = findPlaceholderKey(env, check.keys);
    if (placeholder) {
      requiredFailed.push({
        check,
        kind: "placeholder",
        foundKey: placeholder.key,
        foundValue: placeholder.value,
      });
    } else {
      requiredFailed.push({ check, kind: "missing" });
    }
  }
}

// 3. 输出必填变量
console.log("✅ 必填变量：");
if (requiredPassed.length === 0) {
  console.log("   （无）");
} else {
  for (const { satisfied } of requiredPassed) {
    const displayKey = satisfied.key.padEnd(KEY_PAD_WIDTH);
    const displayValue = formatValue(satisfied.key, satisfied.value);
    console.log(`  ✓ ${displayKey} = ${displayValue}`);
    passCount++;
  }
}
console.log("");

// 4. 输出可选变量
console.log("⚠️  可选变量：");
for (const opt of optionalVars) {
  const value = env[opt.key];
  const paddedKey = opt.key.padEnd(KEY_PAD_WIDTH);
  if (!value) {
    console.log(`  ⚠ ${paddedKey} = [未配置]`);
    warnCount++;
  } else if (isPlaceholder(value)) {
    console.log(`  ⚠ ${paddedKey} = [占位符]`);
    warnCount++;
  } else {
    console.log(`  ✓ ${paddedKey} = ${formatValue(opt.key, value)}`);
    passCount++;
  }
}
console.log("");

// 5. 输出错误详情
if (requiredFailed.length > 0) {
  console.log("❌ 错误：");
  for (const fail of requiredFailed) {
    if (fail.kind === "placeholder" && fail.foundKey) {
      const displayKey = fail.foundKey.padEnd(KEY_PAD_WIDTH);
      console.log(`  ✗ ${displayKey} = [占位符]`);
    } else if (fail.check.keys.length > 1) {
      const displayLabel = fail.check.label.padEnd(KEY_PAD_WIDTH);
      console.log(`  ✗ ${displayLabel} = [缺失]`);
    } else {
      const displayKey = fail.check.keys[0].padEnd(KEY_PAD_WIDTH);
      console.log(`  ✗ ${displayKey} = [缺失]`);
    }
    console.log(`      用途：${fail.check.purpose}`);
    console.log(`      获取方式：${fail.check.howto}`);
    if (fail.check.keys.length > 1) {
      console.log(`      可选 key：${fail.check.keys.join(" / ")}`);
    }
    errorCount++;
  }
  console.log("");
}

// 6. 汇总
console.log(
  `📊 总结：${passCount} 通过 / ${warnCount} 警告 / ${errorCount} 错误`,
);
console.log("");

if (errorCount > 0) {
  console.log(`❌ 校验失败：${errorCount} 个必填变量缺失或为占位符`);
  process.exit(1);
} else {
  console.log("✅ 校验通过：所有必填变量已配置");
  process.exit(0);
}
