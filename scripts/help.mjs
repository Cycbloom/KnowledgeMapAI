#!/usr/bin/env node
/**
 * 帮助脚本
 *
 * 列出所有 npm scripts 与 scripts/ 目录下脚本的用途、参数、使用示例。
 *
 * 用法: npm run help
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const packageJsonPath = join(projectRoot, "package.json");
const scriptsDir = join(projectRoot, "scripts");

// ============================================================
// npm scripts 用途说明映射
// ============================================================
const scriptDescriptions = {
  // 开发
  dev: "启动前端 + API 服务器开发模式（Web）",
  "client:dev": "仅启动 Vite 前端开发服务器",
  "server:dev": "使用 nodemon 启动 API 服务器（热重载）",
  "server:start": "使用 tsx 直接启动 API 服务器（无热重载）",

  // Electron
  "electron:dev": "启动 Electron 桌面应用开发模式",
  "electron:build": "构建所有平台 Electron 应用",
  "electron:build:win": "构建 Windows 平台 Electron 应用",
  "electron:build:mac": "构建 macOS 平台 Electron 应用",
  "electron:build:linux": "构建 Linux 平台 Electron 应用",

  // 构建
  build: "Web 生产构建（tsc -b && vite build）",
  "build:analyze": "构建并分析包体积（rollup-plugin-visualizer）",
  "build:electron": "Electron 构建准备（tsc + vite build）",

  // 预览
  preview: "预览 Web 生产构建（vite preview）",

  // 测试
  test: "watch 模式单元测试（vitest）",
  "test:run": "单次运行单元测试（CI 用）",
  "test:unit": "运行单元测试（排除 e2e）",
  "test:integration": "运行集成测试",
  "test:coverage": "运行测试并生成覆盖率报告",
  "test:db": "pgTAP 数据库测试（需先启动本地 Supabase）",
  "test:e2e": "Playwright E2E 测试",
  "test:e2e:ui": "Playwright E2E 测试（UI 交互模式）",
  "test:e2e:debug": "Playwright E2E 测试（调试模式）",
  "test:e2e:report": "显示 Playwright 测试报告",
  "test:flaky": "运行 E2E 测试 3 次以检测 flaky 测试",
  "test:all": "运行单元测试 + E2E 测试",
  "test:ci": "CI 完整流程：check + lint + test:coverage",

  // 检查
  check: "增量 TypeScript 类型检查（推荐开发时使用）",
  "check:full": "全量 TypeScript 类型检查（--force）",
  "check:electron": "Electron 端 TypeScript 类型检查",
  "check:i18n": "i18n key 一致性检查（key 集合 + 死键检测）",
  "check:env": "校验环境变量配置完整性",
  lint: "ESLint 检查（带缓存）",
  "lint:full": "全量 ESLint 检查（无缓存）",
  "db:check-types": "检查 database.generated.ts 是否为降级骨架",

  // 数据库
  "db:backfill": "批量为现有节点生成向量（embedding）",
  "db:seed": "插入测试数据",
  "db:export": "从 Supabase 导出数据为本地 JSON",
  "db:local:start": "启动本地 Supabase（Docker）",
  "db:local:stop": "停止本地 Supabase",
  "db:local:reset": "重置本地数据库（删除所有数据）",
  "db:local:status": "查看本地 Supabase 状态",
  "db:local:logs": "查看本地 Supabase 日志",
  "db:gen-types": "生成 TypeScript 数据库类型定义",

  // 移动端
  "mobile:build": "构建移动端应用（MOBILE_BUILD=true）",
  "mobile:sync": "构建并同步到 Capacitor",
  "mobile:open": "在 Android Studio 中打开项目",
  "mobile:run": "构建并在 Android 设备上运行",
  "mobile:add": "添加 Android 平台（cap add android）",
  "mobile:build:release": "构建 Android Release 版本",
  "mobile:build:debug": "构建 Android Debug 版本",
  "mobile:test": "运行移动端 E2E 测试（--grep=移动端）",
  "mobile:clean": "清理 Android 构建产物",

  // 辅助
  help: "显示此帮助信息",
  postinstall: "安装后自动重建 Electron 原生模块（electron-rebuild）",
};

// ============================================================
// scripts/ 目录下独立脚本的说明映射
// ============================================================
const scriptFileDescriptions = {
  "backfill_embeddings.ts": "批量为现有节点生成向量（embedding）",
  "check-env.mjs": "校验 .env.development 中必填环境变量的完整性",
  "check-generated-types.mjs": "检查 database.generated.ts 是否为降级骨架",
  "check-i18n-keys.ts":
    "比对 en-US 与 zh-CN 下所有 JSON 文件的 key 路径，报告缺失的 key",
  "check-i18n.mjs": "i18n key 自动化校验（key 集合对比 + 死键检测）",
  "exportFromSupabase.ts": "从 Supabase 导出数据为本地 JSON",
  "generate-icons.mjs": "生成应用图标（PNG/ICO/ICNS，从 SVG 转换）",
  "help.mjs": "显示所有 npm scripts 与 scripts/ 目录下脚本的用途与用法",
  "incremental-check.mjs": "基于 git 暂存文件的增量 TypeScript 检查",
  "run-db-tests.mjs": "运行 pgTAP 数据库测试（需先启动本地 Supabase）",
  "seed_test_data.ts": "插入测试数据（test@example.com 等）",
};

// scripts/ 文件对应的 npm script（如有）
const scriptFileNpmMapping = {
  "backfill_embeddings.ts": "db:backfill",
  "check-env.mjs": "check:env",
  "check-generated-types.mjs": "db:check-types",
  "check-i18n.mjs": "check:i18n",
  "exportFromSupabase.ts": "db:export",
  "help.mjs": "help",
  "run-db-tests.mjs": "test:db",
  "seed_test_data.ts": "db:seed",
};

// ============================================================
// 分类配置
// ============================================================
const categories = [
  {
    name: "开发",
    label: "🚀 开发",
    match: (k) => ["dev", "client:dev", "server:dev", "server:start"].includes(k),
  },
  {
    name: "Electron",
    label: "📦 Electron",
    match: (k) => k.startsWith("electron:"),
  },
  {
    name: "构建",
    label: "🏗️  构建",
    match: (k) => k === "build" || k.startsWith("build:"),
  },
  {
    name: "预览",
    label: "👁️  预览",
    match: (k) => k === "preview",
  },
  {
    name: "测试",
    label: "🧪 测试",
    match: (k) => k === "test" || k.startsWith("test:"),
  },
  {
    name: "检查",
    label: "🔍 检查",
    match: (k) =>
      k === "check" ||
      k.startsWith("check:") ||
      k.startsWith("lint") ||
      k === "db:check-types",
  },
  {
    name: "数据库",
    label: "🗄️  数据库",
    match: (k) => k.startsWith("db:") && k !== "db:check-types",
  },
  {
    name: "移动端",
    label: "📱 移动端",
    match: (k) => k.startsWith("mobile:"),
  },
  {
    name: "辅助",
    label: "🔧 辅助",
    match: (k) => ["help", "postinstall"].includes(k),
  },
];

// ============================================================
// 工具函数
// ============================================================
function padRight(str, len) {
  const diff = len - str.length;
  return diff > 0 ? str + " ".repeat(diff) : str;
}

function getScriptDescription(name) {
  return scriptDescriptions[name] ?? "（未提供说明）";
}

function categorize(name) {
  for (const cat of categories) {
    if (cat.match(name)) return cat;
  }
  return null;
}

// ============================================================
// 主流程
// ============================================================
function main() {
  // 1. 读取 package.json scripts
  const pkgRaw = readFileSync(packageJsonPath, "utf-8");
  const pkg = JSON.parse(pkgRaw);
  const scripts = Object.keys(pkg.scripts ?? {});

  // 2. 读取 scripts/ 目录下的脚本文件
  const scriptFiles = readdirSync(scriptsDir)
    .filter((f) => {
      const full = join(scriptsDir, f);
      return statSync(full).isFile() && /\.(mjs|js|ts)$/.test(f);
    })
    .sort();

  // 3. 按类别分组
  const grouped = new Map();
  const others = [];
  for (const name of scripts) {
    const cat = categorize(name);
    if (cat) {
      if (!grouped.has(cat.name)) grouped.set(cat.name, []);
      grouped.get(cat.name).push(name);
    } else {
      others.push(name);
    }
  }

  // 4. 计算类别数
  const usedCategories = categories.filter(
    (c) => (grouped.get(c.name) ?? []).length > 0,
  );
  const categoryCount = usedCategories.length + (others.length > 0 ? 1 : 0);

  // 5. 输出
  const lines = [];
  lines.push("📖 Knowledge Map 脚本向导");
  lines.push("");
  lines.push(`共 ${scripts.length} 个 npm scripts，分为 ${categoryCount} 个类别。`);
  lines.push("");

  for (const cat of categories) {
    const items = grouped.get(cat.name) ?? [];
    if (items.length === 0) continue;
    lines.push(cat.label);
    const maxNameLen = Math.max(...items.map((n) => `npm run ${n}`.length));
    for (const name of items) {
      const cmd = `npm run ${name}`;
      const desc = getScriptDescription(name);
      lines.push(`  ${padRight(cmd, maxNameLen)}  ${desc}`);
    }
    lines.push("");
  }

  if (others.length > 0) {
    lines.push("📂 其他");
    const maxNameLen = Math.max(...others.map((n) => `npm run ${n}`.length));
    for (const name of others) {
      const cmd = `npm run ${name}`;
      const desc = getScriptDescription(name);
      lines.push(`  ${padRight(cmd, maxNameLen)}  ${desc}`);
    }
    lines.push("");
  }

  // 6. scripts/ 目录下的独立脚本
  lines.push("📂 scripts/ 目录下的独立脚本");
  lines.push("");
  const filePaths = scriptFiles.map((f) => `scripts/${f}`);
  const maxPathLen = Math.max(...filePaths.map((p) => p.length));
  for (const file of scriptFiles) {
    const path = `scripts/${file}`;
    const desc = scriptFileDescriptions[file] ?? "（未提供说明）";
    lines.push(`  ${padRight(path, maxPathLen)}  ${desc}`);
    const npmScript = scriptFileNpmMapping[file];
    const ext = extname(file);
    let usage;
    if (npmScript) {
      usage = `npm run ${npmScript}`;
    } else if (ext === ".ts") {
      usage = `npx tsx ${path}`;
    } else {
      usage = `node ${path}`;
    }
    lines.push(`    用法：${usage}`);
    lines.push("");
  }

  // 7. 提示
  lines.push("💡 提示：");
  lines.push("  - 使用 `npm run <script-name>` 运行上述任意脚本");
  lines.push("  - 完整脚本列表见 package.json 的 scripts 字段");
  lines.push("  - 详细开发指南见 DEVELOPMENT.md");

  console.log(lines.join("\n"));
}

main();
