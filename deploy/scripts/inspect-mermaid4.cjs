const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "dist", "assets");

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
const target = files.find((x) => x.startsWith("vendor-mermaid-") && !x.includes("utils") && !x.includes("parser") && !x.includes("date") && !x.includes("marked") && !x.includes("icons") && !x.includes("rough") && !x.includes("venn") && !x.includes("url") && !x.includes("dedent"));
if (!target) { console.log("main vendor-mermaid chunk not found"); process.exit(0); }
console.log("main mermaid chunk:", target);

const s = fs.readFileSync(path.join(dir, target), "utf8");
const imps = [...s.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
const thisName = target.replace(".js", "");

let cycles = 0;
for (const imp of [...new Set(imps)]) {
  const c = fs.readFileSync(path.join(dir, imp), "utf8");
  if (c.includes(`"${thisName}"`) || c.includes(`.${thisName}.js`)) {
    console.log("CYCLE:", imp, "<->", thisName);
    cycles++;
  }
}
console.log(cycles === 0 ? "RESULT: no cross-chunk cycle for mermaid chunk ✅" : `RESULT: ${cycles} cycle(s) remain ❌`);

// also: does vendor-d3 still exist as separate chunk?
const hasD3 = files.some((f) => f.startsWith("vendor-d3-"));
console.log("vendor-d3 separate chunk exists:", hasD3);
