#!/usr/bin/env node
/**
 * i18n key 自动化校验脚本
 *
 * 功能：
 * 1. 对比 zh-CN 与 en-US 下所有 JSON 文件的 key 集合（含命名空间前缀，如 common.aria.close）
 * 2. 检测死键（在 src/ 下 0 引用的 key）
 * 3. 输出报告到 stdout，exit code 0（非阻塞）
 *
 * 用法: node scripts/check-i18n.mjs
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const localesDir = join(projectRoot, "src", "i18n", "locales");
const srcDir = join(projectRoot, "src");

const EN_DIR = join(localesDir, "en-US");
const ZH_DIR = join(localesDir, "zh-CN");

/**
 * 递归提取对象的扁平化 key 路径（用点号连接）
 * @param {unknown} obj - 待遍历对象
 * @param {string} [prefix] - 当前 key 前缀
 * @returns {string[]} - 扁平化 key 路径数组
 */
function extractKeyPaths(obj, prefix = "") {
  if (obj === null || typeof obj !== "object") {
    return prefix ? [prefix] : [];
  }
  if (Array.isArray(obj)) {
    const paths = [];
    obj.forEach((item, index) => {
      const nextPrefix = prefix ? `${prefix}.${index}` : `${index}`;
      paths.push(...extractKeyPaths(item, nextPrefix));
    });
    return paths;
  }
  const paths = [];
  const record = /** @type {Record<string, unknown>} */ (obj);
  for (const key of Object.keys(record)) {
    const value = record[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    paths.push(...extractKeyPaths(value, fullKey));
  }
  return paths;
}

/**
 * 获取目录下所有 .json 文件名
 * @param {string} dir
 * @returns {Set<string>}
 */
function getJsonFiles(dir) {
  try {
    return new Set(
      readdirSync(dir).filter((f) => f.endsWith(".json")),
    );
  } catch {
    return new Set();
  }
}

/**
 * 加载目录下所有 JSON 文件，返回带命名空间前缀的 key 集合
 * @param {string} dir
 * @returns {Set<string>} - 全部扁平化 key（含命名空间前缀）
 */
function loadAllKeys(dir) {
  const result = new Set();
  const files = getJsonFiles(dir);
  for (const file of files) {
    const namespace = file.replace(/\.json$/, "");
    const filePath = join(dir, file);
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    const keys = extractKeyPaths(data, namespace);
    for (const k of keys) result.add(k);
  }
  return result;
}

/**
 * 递归收集目录下所有 .ts/.tsx 文件路径（跳过 node_modules）
 * @param {string} dir
 * @returns {string[]}
 */
function collectTsFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry === "node_modules") continue;
      results.push(...collectTsFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if (ext === ".ts" || ext === ".tsx") {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * 从源码中提取所有 t('key.path') / t("key.path") 调用的 key
 * 正则匹配 t('xxx') / t("xxx") / i18n.t('xxx') 等模式
 * @param {string[]} files
 * @returns {Set<string>}
 */
function extractReferencedKeys(files) {
  const referenced = new Set();
  const pattern = /t\(['"]([\w.]+)['"]\)/g;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        referenced.add(match[1]);
      }
    }
  }
  return referenced;
}

// --- Main ---
console.log("🔍 i18n key 自动化校验报告");
console.log("=".repeat(60));

// 1. 加载两边 key 集合
const enAllKeys = loadAllKeys(EN_DIR);
const zhAllKeys = loadAllKeys(ZH_DIR);

// 2. 对比两边 key 集合
console.log("\n📐 一、Key 集合对比（zh-CN vs en-US）\n");

const missingInZh = [...enAllKeys].filter((k) => !zhAllKeys.has(k)).sort();
const missingInEn = [...zhAllKeys].filter((k) => !enAllKeys.has(k)).sort();

if (missingInZh.length === 0 && missingInEn.length === 0) {
  console.log("✅ zh-CN 与 en-US 的 key 集合完全一致");
} else {
  if (missingInZh.length > 0) {
    console.log(`❌ zh-CN 缺失（en-US 有 / zh-CN 无）：${missingInZh.length} 个`);
    for (const key of missingInZh) {
      console.log(`   - ${key}`);
    }
  }
  if (missingInEn.length > 0) {
    console.log(`❌ en-US 缺失（zh-CN 有 / en-US 无）：${missingInEn.length} 个`);
    for (const key of missingInEn) {
      console.log(`   - ${key}`);
    }
  }
}

// 3. 死键检测
console.log("\n🔎 二、死键检测（src/ 下 0 引用的 key）\n");

const tsFiles = collectTsFiles(srcDir);
const referencedKeys = extractReferencedKeys(tsFiles);

const allI18nKeys = new Set([...enAllKeys, ...zhAllKeys]);
const deadKeys = [...allI18nKeys]
  .filter((k) => !referencedKeys.has(k))
  .sort();

if (deadKeys.length === 0) {
  console.log("✅ 未发现死键（所有 key 均在 src/ 下有引用）");
} else {
  console.log(`⚠️  疑似死键（${deadKeys.length} 个，在 src/ 下未找到 t('key') 引用）：`);
  console.log("   注：动态拼接的 key（如模板字面量）无法被静态检测，请人工复核。");
  for (const key of deadKeys) {
    console.log(`   - ${key}`);
  }
}

// 4. 汇总
console.log("\n" + "=".repeat(60));
console.log("📊 汇总：");
console.log(`   - zh-CN key 总数：${zhAllKeys.size}`);
console.log(`   - en-US key 总数：${enAllKeys.size}`);
console.log(`   - zh-CN 缺失：${missingInZh.length}`);
console.log(`   - en-US 缺失：${missingInEn.length}`);
console.log(`   - 疑似死键：${deadKeys.length}`);
console.log(`   - 扫描源码文件数：${tsFiles.length}`);
console.log(`   - 提取引用 key 数：${referencedKeys.size}`);
console.log("\nℹ️  本脚本为非阻塞校验（exit code 0），仅输出报告供参考。");

process.exit(0);
