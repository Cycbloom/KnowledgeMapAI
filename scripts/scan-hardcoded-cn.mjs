#!/usr/bin/env node
/**
 * 扫描 src/ 下组件中硬编码的中文 UI 字符串（排除注释、测试文件、i18n locale）
 * 输出按文件分组的命中行，供人工/自动 i18n 化使用。
 *
 * 用法: node scripts/scan-hardcoded-cn.mjs [--json]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const srcDir = "d:/KnowledgeMap/src";
const IGNORE_DIRS = new Set(["node_modules", "dist", "locales", "__tests__"]);
const IGNORE_PATTERNS = /\.(test|spec)\.(ts|tsx)$/;

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
      if (IGNORE_DIRS.has(entry)) continue;
      results.push(...collectTsFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = extname(entry);
      if ((ext === ".ts" || ext === ".tsx") && !IGNORE_PATTERNS.test(entry)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/** 去除注释（行注释 + 块注释），保留字符串 */
function stripComments(content) {
  let out = "";
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === "/" && content[i + 1] === "/") {
      while (i < n && content[i] !== "\n") i++;
    } else if (c === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < n && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** 提取 JSX 文本节点与字符串字面量中的中文（排除 t('...') / t("...") / i18n.t） */
function findHardcodedCn(content) {
  const hits = [];
  const cleaned = stripComments(content);
  // 排除已用 t() 包裹的中文：替换 t('...')/t("...")/t(`...`) 调用体
  const noT = cleaned.replace(/t\(\s*['"`][^'"`]*['"`][^)]*\)/g, "");
  const noI18nT = noT.replace(/i18n\.t\(\s*['"`][^'"`]*['"`][^)]*\)/g, "");

  // 行号计算：按原内容切行，查找包含中文的行
  const lines = content.split("\n");
  const noTLines = noI18nT.split("\n");

  for (let idx = 0; idx < noTLines.length; idx++) {
    const line = noTLines[idx];
    // 只关心出现中文字符的行
    if (!/[\u4e00-\u9fff]/.test(line)) continue;
    // 该行剩余的中文片段（仅限字符串字面量/JSX 文本：引号内 或 JSX 文本内）
    const rawLine = lines[idx] ?? "";
    // 过滤掉纯粹注释行（去注释后为空）与明显非 UI 内容
    if (!/["'`>]/.test(rawLine)) continue;
    const chineseChunks = line.match(/["'`][^"'`]*[\u4e00-\u9fff][^"'`]*["'`]|>[\s]*[^<>{}]*[\u4e00-\u9fff][^<>{}]*</g) || [];
    if (chineseChunks.length > 0) {
      hits.push({
        line: idx + 1,
        raw: rawLine.trim().substring(0, 100),
        chunks: chineseChunks.map((c) => c.trim().substring(0, 60)),
      });
    }
  }
  return hits;
}

const files = collectTsFiles(srcDir);
const report = [];

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const hits = findHardcodedCn(content);
  if (hits.length > 0) {
    report.push({ file: file.replace(/\\/g, "/").replace(srcDir.replace(/\\/g, "/"), ""), hits });
  }
}

report.sort((a, b) => b.hits.length - a.hits.length);

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(report, null, 2));
} else {
  console.log(`扫描完成：${files.length} 个源文件，${report.length} 个文件含疑似硬编码中文 UI 字符串\n`);
  for (const r of report) {
    console.log(`\n📄 ${r.file} (${r.hits.length} 处)`);
    for (const h of r.hits.slice(0, 4)) {
      console.log(`   L${h.line}: ${h.chunks.join(" | ")}`);
    }
    if (r.hits.length > 4) console.log(`   ... 共 ${r.hits.length} 处`);
  }
}
