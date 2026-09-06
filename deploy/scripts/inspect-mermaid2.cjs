const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "dist", "assets");

const target = "vendor-mermaid-DHoxxY22";
const file = fs.readdirSync(dir).find((x) => x.startsWith(target) && x.endsWith(".js"));
if (!file) { console.log("target chunk not found"); process.exit(0); }
const s = fs.readFileSync(path.join(dir, file), "utf8");
console.log("chunk:", file, "len:", s.length);

// imports of this chunk (cross-chunk)
const imps = [...s.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
console.log("this chunk imports:", [...new Set(imps)].join(", ") || "(none)");

// which chunks import THIS chunk
const thisName = file.replace(".js", "");
const refs = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js") || f === file) continue;
  const c = fs.readFileSync(path.join(dir, f), "utf8");
  if (c.includes(`"${thisName}"`) || c.includes(`.${thisName}.js`)) refs.push(f.replace(".js", ""));
}
console.log("chunks importing this one (cross-chunk):", refs.join(", ") || "(none)");

// if it imports vendor-react, find what vendor-react imports back
for (const imp of [...new Set(imps)]) {
  if (!imp.startsWith("vendor-react")) continue;
  const r = fs.readFileSync(path.join(dir, imp), "utf8");
  const rimps = [...r.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
  const back = rimps.filter((x) => x.includes("vendor-mermaid"));
  console.log("cycle check:", imp, "imports-back-mermaid:", back.join(", ") || "(none)");
}
