const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "dist", "assets");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));

const importsOf = {};
for (const f of files) {
  const c = fs.readFileSync(path.join(dir, f), "utf8");
  importsOf[f] = [...c.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
}

let cycles = [];
for (const a of files) {
  for (const b of importsOf[a] || []) {
    if (b === a) continue;
    if ((importsOf[b] || []).includes(a)) {
      const key = [a, b].sort().join(" <-> ");
      if (!cycles.includes(key)) cycles.push(key);
    }
  }
}
console.log("cross-chunk cycles found:", cycles.length);
for (const c of cycles) console.log("  ", c);
