// Electron main-process build via esbuild.
// Resolves the `@shared/*` alias and relative imports at build time, producing
// self-contained bundles that run natively under "type": "module". This replaces
// the previous tsc-emit + normalize-electron-imports.mjs post-processing step.
import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rmSync, mkdirSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist-electron");

// Only bundle the project's own code (relative imports + the `@shared/*` alias).
// All node_modules packages stay external and load from node_modules at runtime,
// which avoids dynamically-required packages (e.g. `depd`) breaking the bundle.
const common = {
  bundle: true,
  platform: "node",
  alias: { "@shared": resolve(root, "shared") },
  packages: "external",
  logLevel: "info",
  sourcemap: true,
  absWorkingDir: root,
};

const entries = [
  // Electron main process (ESM, sandbox-compatible preload kept as CJS).
  { in: "electron/main.ts", outfile: "electron/main.js", format: "esm" },
  { in: "electron/preload.ts", outfile: "electron/preload.js", format: "cjs" },
  // Embedded api loaded by the main process at runtime.
  { in: "api/app.ts", outfile: "api/app.js", format: "esm" },
  {
    in: "api/services/migration/migrationService.ts",
    outfile: "api/services/migration/migrationService.js",
    format: "esm",
  },
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of entries) {
  await build({
    ...common,
    entryPoints: [resolve(root, entry.in)],
    outfile: resolve(out, entry.outfile),
    format: entry.format,
  });
}

console.log("[build-electron] done");