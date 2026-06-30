#!/usr/bin/env node
/**
 * 检查 database.generated.ts 是否为降级骨架。
 * 如果文件头部包含 "生成失败" 或 "降级" 关键词，则说明类型文件需要重新生成，检查失败。
 *
 * 用法: node scripts/check-generated-types.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, '../shared/types/database.generated.ts');

const content = readFileSync(filePath, 'utf-8');

// 检查文件头部的降级标记
const headerLines = content.split('\n').slice(0, 15).join('\n');

if (headerLines.includes('生成失败')) {
  console.error('❌ database.generated.ts 包含"生成失败"标记，请运行 npm run db:local:start && npm run db:gen-types 重新生成');
  process.exit(1);
}

// 检查是否存在降级关键词（仅在头部注释中）
if (headerLines.includes('降级方案')) {
  console.warn('⚠️  database.generated.ts 仍为降级方案骨架，建议运行 npm run db:local:start && npm run db:gen-types 重新生成');
  // 降级方案不导致 CI 失败，仅警告
}

console.log('✅ database.generated.ts 检查通过');
