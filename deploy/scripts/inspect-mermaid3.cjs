const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "dist", "assets");

const target = "vendor-mermaid-DHoxxY22";
const file = fs.readdirSync(dir).find((x) => x.startsWith(target) && x.endsWith(".js"));
const s = fs.readFileSync(path.join(dir, file), "utf8");
const imps = [...s.matchAll(/from"\.\/([a-zA-Z0-9._-]+\.js)"/g)].map((m) => m[1]);
const thisName = file.replace(".js", "");

for (const imp of [...new Set(imps)]) {
  const c = fs.readFileSync(path.join(dir, imp), "utf8");
  // does imp chunk import back into this chunk?
  const back = c.includes(thisName) || c.includes(`.${thisName}.js`) || c.includes(`"${thisName}"`);
  if (back) {
    // find what symbol path
    const m = c.match(new RegExp(`from"\\./${thisName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.js"`));
    console.log("CYCLE:", imp, "<->", thisName, m ? `(import at: ${m.index})` : "");
  } else {
    console.log("ok:   ", imp);
  }
}
