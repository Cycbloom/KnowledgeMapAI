import { existsSync } from "node:fs";
import { resolve } from "node:path";

interface CheckResult {
  name: string;
  status: "✅" | "❌" | "⚠️";
  message: string;
  critical: boolean;
}

const results: CheckResult[] = [];
let hasCriticalFailure = false;

function record(
  name: string,
  status: "✅" | "❌" | "⚠️",
  message: string,
  critical = false,
) {
  results.push({ name, status, message, critical });
  if (critical && status === "❌") {
    hasCriticalFailure = true;
  }
}

// Check Node.js version
try {
  const nodeVersion = process.version.slice(1); // remove "v" prefix
  const major = parseInt(nodeVersion.split(".")[0], 10);
  if (major >= 20) {
    record("Node.js 版本", "✅", `v${nodeVersion} (>= 20.0.0 ✓)`);
  } else {
    record("Node.js 版本", "❌", `v${nodeVersion} (< 20.0.0 ✗)`, true);
  }
} catch {
  record("Node.js 版本", "❌", "无法获取 Node.js 版本", true);
}

// Check environment variables
const envVars: { name: string; key: string; optional: boolean }[] = [
  { name: "VITE_SUPABASE_URL", key: "VITE_SUPABASE_URL", optional: false },
  { name: "VITE_SUPABASE_ANON_KEY", key: "VITE_SUPABASE_ANON_KEY", optional: false },
  { name: "ALIYUN_API_KEY", key: "ALIYUN_API_KEY", optional: true },
];

for (const env of envVars) {
  const value = process.env[env.key];
  if (value) {
    const masked = value.length > 8
      ? value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4)
      : "***";
    record(`${env.key}`, "✅", masked, !env.optional);
  } else if (env.optional) {
    record(`${env.key}`, "⚠️", "未设置（可选）");
  } else {
    record(`${env.key}`, "❌", "未设置（必需）", true);
  }
}

// Check node_modules
const nodeModulesPath = resolve(process.cwd(), "node_modules");
if (existsSync(nodeModulesPath)) {
  record("node_modules", "✅", "存在");
} else {
  record("node_modules", "❌", "不存在，请运行 npm install", true);
}

// Check .env.development
const envDevPath = resolve(process.cwd(), ".env.development");
if (existsSync(envDevPath)) {
  record(".env.development", "✅", "存在");
} else {
  record(".env.development", "⚠️", "不存在，环境变量可能未加载");
}

// Print report
const separator = "=".repeat(56);
console.log(`\n${separator}`);
console.log("  🔍 KnowledgeMap 环境诊断报告");
console.log(`${separator}\n`);

for (const r of results) {
  const icon = r.status;
  console.log(`  ${icon}  ${r.name}`);
  console.log(`      ${r.message}`);
}

console.log(`\n${separator}`);
const passed = results.filter((r) => r.status === "✅").length;
const warned = results.filter((r) => r.status === "⚠️").length;
const failed = results.filter((r) => r.status === "❌").length;
console.log(`  总计: ${results.length}  |  ✅ ${passed}  |  ⚠️ ${warned}  |  ❌ ${failed}`);
console.log(`${separator}\n`);

if (hasCriticalFailure) {
  process.exit(1);
}