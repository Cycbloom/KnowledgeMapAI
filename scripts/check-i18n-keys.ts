#!/usr/bin/env npx tsx
/**
 * i18n key 一致性检查脚本
 * 比对 en-US 与 zh-CN 目录下所有 JSON 文件的 key 路径，报告缺失的 key
 *
 * 用法: npx tsx scripts/check-i18n-keys.ts
 *       npx tsx scripts/check-i18n-keys.ts --json   (JSON 输出，供 CI 解析)
 */

import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, "../src/i18n/locales");

const EN_DIR = join(localesDir, "en-US");
const ZH_DIR = join(localesDir, "zh-CN");

const useJsonOutput = process.argv.includes("--json");

/** 递归提取所有 key 路径（用点号分隔） */
function extractKeyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") {
    return [prefix];
  }
  if (Array.isArray(obj)) {
    const paths: string[] = [];
    obj.forEach((item, index) => {
      paths.push(...extractKeyPaths(item, prefix ? `${prefix}.${index}` : `${index}`));
    });
    return paths;
  }
  const paths: string[] = [];
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    paths.push(...extractKeyPaths((obj as Record<string, unknown>)[key], fullKey));
  }
  return paths;
}

function getJsonFiles(dir: string): Set<string> {
  try {
    return new Set(
      readdirSync(dir).filter((f) => f.endsWith(".json")),
    );
  } catch {
    return new Set();
  }
}

function loadJson(filePath: string): unknown {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// --- Main ---
const enFiles = getJsonFiles(EN_DIR);
const zhFiles = getJsonFiles(ZH_DIR);

const allFiles = new Set([...enFiles, ...zhFiles]);
const sortedFiles = [...allFiles].sort();

const results: {
  file: string;
  status: "ok" | "missing-file" | "missing-keys";
  missingInZh: string[];
  missingInEn: string[];
}[] = [];

let hasDiff = false;
let totalMissing = 0;

for (const file of sortedFiles) {
  const inEn = enFiles.has(file);
  const inZh = zhFiles.has(file);

  if (!inEn) {
    if (!useJsonOutput) console.log(`❌ ${file}: file only exists in zh-CN (missing in en-US)`);
    results.push({ file, status: "missing-file", missingInZh: [], missingInEn: [`[file] ${file}`] });
    hasDiff = true;
    totalMissing++;
    continue;
  }
  if (!inZh) {
    if (!useJsonOutput) console.log(`❌ ${file}: file only exists in en-US (missing in zh-CN)`);
    results.push({ file, status: "missing-file", missingInZh: [`[file] ${file}`], missingInEn: [] });
    hasDiff = true;
    totalMissing++;
    continue;
  }

  const enData = loadJson(join(EN_DIR, file));
  const zhData = loadJson(join(ZH_DIR, file));

  const enKeys = new Set(extractKeyPaths(enData));
  const zhKeys = new Set(extractKeyPaths(zhData));

  const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k)).sort();
  const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k)).sort();

  if (missingInZh.length === 0 && missingInEn.length === 0) {
    if (!useJsonOutput) console.log(`✅ ${file}: keys match`);
    results.push({ file, status: "ok", missingInZh: [], missingInEn: [] });
    continue;
  }

  hasDiff = true;
  results.push({ file, status: "missing-keys", missingInZh, missingInEn });

  if (!useJsonOutput) {
    if (missingInZh.length > 0) {
      console.log(
        `❌ ${file}: ${missingInZh.length} key(s) missing in zh-CN (present in en-US)`,
      );
      for (const key of missingInZh) {
        console.log(`   - ${key}`);
      }
      totalMissing += missingInZh.length;
    }

    if (missingInEn.length > 0) {
      console.log(
        `❌ ${file}: ${missingInEn.length} key(s) missing in en-US (present in zh-CN)`,
      );
      for (const key of missingInEn) {
        console.log(`   - ${key}`);
      }
      totalMissing += missingInEn.length;
    }
  }
}

if (useJsonOutput) {
  process.stdout.write(JSON.stringify({ hasDiff, totalMissing, results }, null, 2));
  process.exit(hasDiff ? 1 : 0);
}

console.log("");
if (hasDiff) {
  console.log(`❌ Found ${totalMissing} key differences across locales`);
  process.exit(1);
} else {
  console.log("✅ All i18n keys match between en-US and zh-CN");
  process.exit(0);
}