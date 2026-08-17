// @knowledgemap/dsh-km-ui — host half.
//
// KnowledgeMap fusion UI for DeepSeek Harness.
//
// The browser half invokes two slash-commands over the built-in `commands`
// remote: `/km-ui-overview` (six-domain aggregate, called by the 📊 header
// button) and `/km-ui-queue [limit]` (due review queue, called by the 🧠
// button / composer dock). Each handler reads the six domain JSON stores
// under the target session's workspace and returns the payload as JSON in
// `text`; the client JSON-parses it.
//
// Privacy: both commands declare `recordInput: false`, so nothing lands in
// the session log — the overview carries no user text at all and the queue
// limit is trivial.
const inject = ["commands", "fs", "sandboxPolicy"];

const BASE = ".deepseek-harness/knowledgemap";
const FILES = {
  cards: "cards.json",
  graphs: "graphs.json",
  tasks: "tasks.json",
  progress: "progress.json",
  paths: "paths.json",
  notes: "notes.json"
};

/** Read one domain store as JSON; any failure yields an empty object. */
async function readStore(fs, root, key) {
  try {
    const target = await fs.resolve(BASE + "/" + FILES[key], { cwd: root });
    const info = await fs.stat(target);
    if (!info) return {};
    const parsed = JSON.parse(await fs.readText(target));
    if (parsed && typeof parsed === "object") return parsed;
  } catch (error) {
    /* missing or malformed store — treat as empty */
  }
  return {};
}

/** Read all six domains for one workspace root. */
async function readAll(fs, root) {
  const cards = await readStore(fs, root, "cards");
  const graphs = await readStore(fs, root, "graphs");
  const tasks = await readStore(fs, root, "tasks");
  const progress = await readStore(fs, root, "progress");
  const paths = await readStore(fs, root, "paths");
  const notes = await readStore(fs, root, "notes");
  return {
    root,
    cards: cards.cards || [],
    graphs: graphs.graphs || [],
    nodes: graphs.nodes || [],
    edges: graphs.edges || [],
    tasks: tasks.tasks || [],
    paths: paths.paths || [],
    notes: notes.notes || [],
    noteLinks: notes.links || [],
    progress: progress.xp !== undefined ? progress : null
  };
}

/** Six-domain overview payload for the 📊 panel. */
function buildOverview(d) {
  const now = Date.now();
  const dueNow = d.cards.filter((c) => c.state === 0 || (c.state !== 0 && c.due <= now)).length;
  const activeTasks = d.tasks.filter((t) => ["pending", "in_progress", "paused"].includes(t.status)).length;
  const activePaths = d.paths.filter((p) => p.status === "active").length;
  const p = d.progress;
  return {
    study: { total: d.cards.length, due_now: dueNow },
    graphs: { total: d.graphs.length, nodes: d.nodes.length, edges: d.edges.length },
    tasks: { total: d.tasks.length, active: activeTasks },
    paths: { total: d.paths.length, active: activePaths },
    notes: { total: d.notes.length, wiki_mounts: d.noteLinks.length },
    progress: p
      ? {
          level: p.level,
          xp: p.xp,
          streak: p.streak,
          achievements: Object.keys(p.unlocked || {}).length
        }
      : null,
    updated_at: new Date().toISOString()
  };
}

/** Due review queue payload for the 🧠 toggle / composer dock. */
function buildQueue(d, limit) {
  const now = Date.now();
  const isDue = (c) => c.state === 0 || (c.state !== 0 && c.due <= now);
  const due = d.cards
    .filter(isDue)
    .sort((a, b) => (a.due || 0) - (b.due || 0))
    .slice(0, limit || 5)
    .map((c) => ({
      id: c.id,
      deck: c.deck,
      front: c.front,
      state: ["new", "learning", "review", "relearning"][c.state] || "new",
      due: c.due
    }));
  return { queue: due, total: d.cards.filter(isDue).length };
}

/** Workspace root for the invocation's session, falling back to the sandbox root. */
function cwdOf(ctx, invocation) {
  try {
    const cwd = invocation.agent.session.header.cwd;
    if (cwd && typeof cwd === "string") return cwd;
  } catch (error) {
    /* ignore */
  }
  return ctx.sandboxPolicy.workspaceRoot;
}

function apply(ctx) {
  const { fs } = ctx;

  ctx.commands.register({
    name: "km-ui-overview",
    description: "KnowledgeMap 六域总览数据（📊 按钮调用）",
    recordInput: false,
    handler: async (invocation) => {
      try {
        const data = await readAll(fs, cwdOf(ctx, invocation));
        return { kind: "success", text: JSON.stringify(buildOverview(data)) };
      } catch (error) {
        return { kind: "error", text: "km-ui-overview failed: " + String(error) };
      }
    }
  });

  ctx.commands.register({
    name: "km-ui-queue",
    description: "KnowledgeMap 到期复习队列数据（🧠 按钮调用）",
    recordInput: false,
    handler: async (invocation) => {
      try {
        const limit = parseInt(String(invocation.rawInput || "").trim(), 10) || 5;
        const data = await readAll(fs, cwdOf(ctx, invocation));
        return { kind: "success", text: JSON.stringify(buildQueue(data, limit)) };
      } catch (error) {
        return { kind: "error", text: "km-ui-queue failed: " + String(error) };
      }
    }
  });
}

export { apply, inject };
