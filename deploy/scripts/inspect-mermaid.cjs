const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "dist", "assets");
const file = fs.readdirSync(dir).find((x) => x.startsWith("vendor-mermaid-") && x.endsWith(".js"));
if (!file) { console.log("no vendor-mermaid chunk"); process.exit(0); }
const s = fs.readFileSync(path.join(dir, file), "utf8");
console.log("chunk:", file, "len:", s.length);
const imps = [...s.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
console.log("cross-chunk imports from vendor-mermaid:", [...new Set(imps)].join(", ") || "(none)");
// find which chunks import vendor-mermaid
const chunkName = file.replace(".js", "");
const refs = [];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js") || f === file) continue;
  const c = fs.readFileSync(path.join(dir, f), "utf8");
  if (c.includes(chunkName)) refs.push(f.replace(".js", ""));
}
console.log("chunks that reference vendor-mermaid:", refs.join(", ") || "(none)");
