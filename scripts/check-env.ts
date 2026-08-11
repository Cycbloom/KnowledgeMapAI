import { existsSync } from "node:fs";
import { resolve } from "node:path";

const requiredVars = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
];

let hasWarning = false;

console.log("\n📋 启动环境变量检查...\n");

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value) {
    console.warn(`  ⚠️  环境变量 ${varName} 未设置`);
    hasWarning = true;
  } else {
    const masked = value.length > 8
      ? value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4)
      : "***";
    console.log(`  ✅ ${varName} = ${masked}`);
  }
}

// Check .env.development file
const envDevPath = resolve(process.cwd(), ".env.development");
if (existsSync(envDevPath)) {
  console.log(`  ✅ .env.development 文件存在`);
} else {
  console.warn(`  ⚠️  .env.development 文件不存在`);
  hasWarning = true;
}

if (hasWarning) {
  console.log("\n  ⚠️  部分环境变量缺失，但启动将继续（某些功能可能受限）\n");
} else {
  console.log("\n  ✅ 所有环境变量检查通过\n");
}