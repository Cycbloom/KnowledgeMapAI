// Pre-flight smoke test for @knowledgemap/dsh-km-ui (durable web-profile package)
// Run: node smoke-client.js
// Simulates the browser client-modules environment: window.__ModuleLoader__.load
// captures the factory; a mock ctx supplies slots/remote; a react stub makes the
// hook-based components render safely. Verifies the 4 slot registrations and a
// component render round-trip (RPC mocked).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const clientSrc = readFileSync(join(here, "lib", "client.js"), "utf8");

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load: (handoff) => { captured = handoff; },
  },
};
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, set textContent(v) {}, head: { appendChild() {} } }),
  head: { appendChild() {} },
};

// Execute the bundle — registers the factory
new Function(clientSrc)();
if (!captured) throw new Error("bundle did not call __ModuleLoader__.load");
if (captured.id !== "@knowledgemap/dsh-km-ui") throw new Error("wrong id: " + captured.id);

// React stub: useState/useEffect/useRef minimal no-throw
const reactStub = {
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useEffect: (fn) => { try { const r = fn(); if (r && typeof r === "function") { /* ignore cleanup */ } } catch (e) { throw e; } },
  useRef: (init) => ({ current: init }),
  createElement: (...args) => ({ kind: "element", args }),
};
const requireStub = (spec) => {
  if (spec === "react") return reactStub;
  throw new Error("unexpected require: " + spec);
};

const moduleObj = captured.factory(requireStub);
if (typeof moduleObj.apply !== "function") throw new Error("exports.apply missing");
if (!Array.isArray(moduleObj.inject)) throw new Error("exports.inject missing");
console.log("factory OK — inject:", JSON.stringify(moduleObj.inject));

// Mock ctx: slots.inject captures (name, callback) pairs; remote.commands returns JSON payloads
const registrations = [];
const injected = [];
const mockCtx = {
  slots: {
    inject: (name, cb) => { injected.push(name); registrations.push({ name, cb }); return () => {}; },
    register: (meta, render) => ({ meta, render }),
  },
  remote: {
    commands: {
      execute: (sessionId, line) => {
        const cmd = String(line).split(" ")[0].replace("/", "");
        const payload = cmd === "km-ui-overview"
          ? { study: { total: 3, due_now: 2 }, graphs: { total: 1, nodes: 4, edges: 3 }, tasks: { total: 3, active: 2 },
              paths: { total: 1, active: 0 }, notes: { total: 2, wiki_mounts: 4 },
              progress: { level: 2, xp: 40, streak: 1, achievements: 4 } }
          : { queue: [{ id: "c1", deck: "算法", front: "Q1", state: "learning", due: 1 }], total: 1 };
        return Promise.resolve({ ok: true, value: { result: { kind: "success", text: JSON.stringify(payload) } } });
      },
    },
  },
};

moduleObj.apply(mockCtx);

const expected = ["conversation.composer.dock", "conversation.input.right", "conversation.session.header.utilities", "shell.overlay"];
for (const name of expected) {
  if (!injected.includes(name)) throw new Error("slot not injected: " + name);
}
console.log("apply OK — injected slots:", injected.join(", "));

// Render every registered component with minimal props; ensure no throw and structure sanity
let renders = 0;
for (const reg of registrations) {
  const { meta, render } = reg.cb(); // slots.inject callback returns the registration
  if (!meta || !meta.id) throw new Error("registration missing meta.id for " + reg.name);
  const props = { sessionId: "session-test", useSessions: () => ({}), useSession: () => ({}), useInput: () => ({}), inputActions: {} };
  const el = render(props);
  if (!el || typeof el !== "object") throw new Error("render returned nothing for " + meta.id);
  renders += 1;
  console.log("render OK —", meta.id, "order", meta.order, "label:", meta.label);
}
if (renders !== 4) throw new Error("expected 4 renders, got " + renders);
console.log("\nALL CLIENT CHECKS PASSED ✔");
