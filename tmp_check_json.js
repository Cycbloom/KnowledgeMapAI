const fs = require("fs");
const content = fs.readFileSync(
  "d:/KnowledgeMap/src/i18n/locales/zh-CN.json",
  "utf8",
);

// Extract all top-level keys (keys at root level, indentation 2)
const topLevelKeys = [];
const lines = content.split("\n");
let braceDepth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (trimmed === "{") braceDepth++;
  if (trimmed === "}" || trimmed === "},") braceDepth--;
  if (braceDepth === 0 && trimmed.startsWith('"') && trimmed.includes(":")) {
    topLevelKeys.push({ line: i + 1, key: trimmed.split(":")[0] });
  }
}

// Check for duplicates
const seen = new Map();
const duplicates = [];
for (const { line, key } of topLevelKeys) {
  if (seen.has(key)) {
    duplicates.push({ key, firstLine: seen.get(key), secondLine: line });
  } else {
    seen.set(key, line);
  }
}

if (duplicates.length > 0) {
  console.log("DUPLICATE TOP-LEVEL KEYS:");
  duplicates.forEach((d) =>
    console.log(`  ${d.key}: lines ${d.firstLine} and ${d.secondLine}`),
  );
} else {
  console.log(
    "No duplicate top-level keys. Total top-level keys:",
    topLevelKeys.length,
  );
}

// Also try to find the position 44254
console.log("\nContent at position 44230-44280:");
console.log(content.substring(44230, 44280));
console.log(
  "\nContent at position 44200-44260:",
  content.substring(44200, 44260),
);

// Check nesting around position 44254
const beforePos = content.substring(0, 44254);
let openBraces = 0;
for (const ch of beforePos) {
  if (ch === "{") openBraces++;
  if (ch === "}") openBraces--;
}
console.log("\nBrace balance at position 44254:", openBraces);