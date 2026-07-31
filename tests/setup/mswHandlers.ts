/**
 * Default MSW handlers for HTTP API endpoints.
 *
 * 设计原则:
 * - 默认返回 SUCCESS 响应,包含最小可用数据(空数组、仅含必填字段的对象)
 * - 使用 MSW v2 API(http.get / http.post / HttpResponse),不使用 v1 的 rest
 * - 每个 handler 保持简单;需要特定数据的测试通过 server.use() 覆盖
 * - 同时导出单个 handler,便于测试按需组合导入
 *
 * 注意:MSW 仅拦截 HTTP 请求。Supabase 客户端直连(若不走 HTTP)不在 MSW 覆盖范围内。
 *
 * 路由来源(基于 api/services/plugins/*.ts 的 registerRoutes 调用):
 * - core 插件:   /api/v1/auth, /api/v1/health, /api/v1/dashboard, /api/v1/sync ...
 * - graph 插件:  /api/v1/graphs, /api/v1/nodes, /api/v1/graph-nodes, /api/v1/domains ...
 * - notes 插件:  /api/v1/notes
 * - ai 插件:     /api/v1/ai, /api/v1/ai-actions, /api/v1/prompts, /api/v1/rag, /api/v1/search ...
 * - scheduler:   /api/v1/tasks, /api/v1/scheduler, /api/v1/achievements ...
 * - SSE 端点:    /api/v1/tasks/events (在 api/routes/tasks.ts 中定义)
 */
import { http, HttpResponse } from "msw";

// ============================================================
// 类型定义:默认 mock 数据结构
// ============================================================

interface MockUserProfile {
  name: string;
  avatar_url: string | null;
  settings: Record<string, unknown>;
}

interface MockUser {
  id: string;
  email: string;
  user_metadata: { name: string };
  profile: MockUserProfile;
}

interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

interface MockGraph {
  id: string;
  user_id: string;
  topic: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface MockNode {
  id: string;
  graph_id: string;
  title: string;
  content: string | null;
  level: string;
  x_position: number;
  y_position: number;
  created_at: string;
  updated_at: string;
}

interface MockNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: "note" | "daily";
  is_archived: boolean;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// 稳定的默认 mock 数据(使用固定 ID 以保证测试确定性)
// ============================================================

const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_GRAPH_ID = "00000000-0000-4000-8000-000000000002";
const DEFAULT_NODE_ID = "00000000-0000-4000-8000-000000000003";
const DEFAULT_NOTE_ID = "00000000-0000-4000-8000-000000000004";

const defaultUser: MockUser = {
  id: DEFAULT_USER_ID,
  email: "test@example.com",
  user_metadata: { name: "Test User" },
  profile: {
    name: "Test User",
    avatar_url: null,
    settings: {},
  },
};

const defaultSession: MockSession = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
};

const defaultGraph: MockGraph = {
  id: DEFAULT_GRAPH_ID,
  user_id: DEFAULT_USER_ID,
  topic: "Mock Graph",
  description: null,
  is_public: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const defaultNode: MockNode = {
  id: DEFAULT_NODE_ID,
  graph_id: DEFAULT_GRAPH_ID,
  title: "Mock Node",
  content: null,
  level: "normal",
  x_position: 0,
  y_position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const defaultNote: MockNote = {
  id: DEFAULT_NOTE_ID,
  user_id: DEFAULT_USER_ID,
  title: "Mock Note",
  content: "",
  type: "note",
  is_archived: false,
  is_pinned: false,
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// ============================================================
// SSE 流:返回 text/event-stream,保持连接打开,30s 后自动关闭
// ============================================================

const createSseStream = (): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  const initialEvent = `data: ${JSON.stringify({ type: "connected", message: "SSE connection established" })}\n\n`;
  const heartbeat = ": ping\n\n";

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(initialEvent));
      controller.enqueue(encoder.encode(heartbeat));

      // 30s 后自动关闭,避免测试挂起
      setTimeout(() => {
        try {
          controller.close();
        } catch {
          // 流可能已被消费方关闭,忽略
        }
      }, 30000);
    },
  });
};

// ============================================================
// Auth 端点 (/api/v1/auth)
// ============================================================

export const registerHandler = http.post("/api/v1/auth/register", () =>
  HttpResponse.json({ user: defaultUser, session: defaultSession }, { status: 201 }),
);

export const loginHandler = http.post("/api/v1/auth/login", () =>
  HttpResponse.json({ user: defaultUser, session: defaultSession }),
);

export const refreshHandler = http.post("/api/v1/auth/refresh", () =>
  HttpResponse.json({ user: defaultUser, session: defaultSession }),
);

export const logoutHandler = http.post("/api/v1/auth/logout", () =>
  HttpResponse.json({ message: "退出登录成功" }),
);

export const getUserHandler = http.get("/api/v1/auth/user", () =>
  HttpResponse.json({ user: defaultUser }),
);

export const updateProfileHandler = http.put("/api/v1/auth/profile", () =>
  HttpResponse.json({ user: defaultUser }),
);

// ============================================================
// CSRF token 端点
// ============================================================

export const csrfTokenHandler = http.get("/api/v1/csrf-token", () =>
  HttpResponse.json({ csrfToken: "mock-csrf-token" }),
);

// ============================================================
// Graph 端点 (/api/v1/graphs)
// ============================================================

export const listGraphsHandler = http.get("/api/v1/graphs", () =>
  HttpResponse.json([defaultGraph]),
);

export const getGraphHandler = http.get("/api/v1/graphs/:id", () =>
  HttpResponse.json(defaultGraph),
);

export const createGraphHandler = http.post("/api/v1/graphs", () =>
  HttpResponse.json(defaultGraph, { status: 201 }),
);

export const updateGraphHandler = http.put("/api/v1/graphs/:id", () =>
  HttpResponse.json(defaultGraph),
);

export const deleteGraphHandler = http.delete("/api/v1/graphs/:id", () =>
  HttpResponse.json({ success: true }),
);

export const listTrashHandler = http.get("/api/v1/graphs/trash", () =>
  HttpResponse.json([]),
);

export const getGraphTagsHandler = http.get("/api/v1/graphs/tags", () =>
  HttpResponse.json([]),
);

export const getGraphDomainsHandler = http.get("/api/v1/graphs/domains", () =>
  HttpResponse.json([]),
);

// ============================================================
// Node 端点
// - /api/v1/graphs/:id/nodes  (图节点列表,定义在 graphs/analysis.ts)
// - /api/v1/nodes             (节点 CRUD,挂载前缀 /api)
// ============================================================

export const getGraphNodesHandler = http.get(
  "/api/v1/graphs/:id/nodes",
  () => HttpResponse.json([defaultNode]),
);

export const createNodeHandler = http.post("/api/v1/nodes", () =>
  HttpResponse.json(defaultNode, { status: 201 }),
);

export const getNodeHandler = http.get("/api/v1/nodes/:id", () =>
  HttpResponse.json(defaultNode),
);

export const updateNodeHandler = http.put("/api/v1/nodes/:id", () =>
  HttpResponse.json(defaultNode),
);

export const deleteNodeHandler = http.delete("/api/v1/nodes/:id", () =>
  HttpResponse.json({ success: true }),
);

// ============================================================
// Note 端点 (/api/v1/notes)
// ============================================================

export const listNotesHandler = http.get("/api/v1/notes", () =>
  HttpResponse.json({ items: [defaultNote], total: 1, page: 1, pageSize: 20 }),
);

export const getNoteHandler = http.get("/api/v1/notes/:id", () =>
  HttpResponse.json(defaultNote),
);

export const createNoteHandler = http.post("/api/v1/notes", () =>
  HttpResponse.json(defaultNote, { status: 201 }),
);

export const updateNoteHandler = http.put("/api/v1/notes/:id", () =>
  HttpResponse.json(defaultNote),
);

export const deleteNoteHandler = http.delete("/api/v1/notes/:id", () =>
  HttpResponse.json({ success: true }),
);

// ============================================================
// SSE 端点 (/api/v1/tasks/events)
// 返回 text/event-stream 流,默认发送 connected 事件与 heartbeat
// ============================================================

export const sseEventsHandler = http.get("/api/v1/tasks/events", () =>
  new HttpResponse(createSseStream(), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  }),
);

// ============================================================
// AI 端点 (/api/v1/ai)
// - chat 默认返回简单 JSON(非流式);流式响应由具体测试通过 server.use() 覆盖
// - extract-concepts / suggest-next-topic 返回 JSON
// ============================================================

export const aiChatHandler = http.post("/api/v1/ai/chat", () =>
  HttpResponse.json({
    response: "Mock AI response",
    session_id: "mock-session-id",
  }),
);

export const aiExtractConceptsHandler = http.post(
  "/api/v1/ai/extract-concepts",
  () => HttpResponse.json({ concepts: [] }),
);

export const aiSuggestNextTopicHandler = http.post(
  "/api/v1/ai/suggest-next-topic",
  () => HttpResponse.json({ suggestions: [] }),
);

// ============================================================
// Health 端点 (/api/v1/health)
// ============================================================

export const healthHandler = http.get("/api/v1/health", () =>
  HttpResponse.json({ status: "ok" }),
);

// ============================================================
// 汇总导出:默认 handler 数组
// ============================================================

export const handlers = [
  // Auth
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getUserHandler,
  updateProfileHandler,
  // CSRF
  csrfTokenHandler,
  // Graphs
  listGraphsHandler,
  getGraphHandler,
  createGraphHandler,
  updateGraphHandler,
  deleteGraphHandler,
  listTrashHandler,
  getGraphTagsHandler,
  getGraphDomainsHandler,
  // Nodes
  getGraphNodesHandler,
  createNodeHandler,
  getNodeHandler,
  updateNodeHandler,
  deleteNodeHandler,
  // Notes
  listNotesHandler,
  getNoteHandler,
  createNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
  // SSE
  sseEventsHandler,
  // AI
  aiChatHandler,
  aiExtractConceptsHandler,
  aiSuggestNextTopicHandler,
  // Health
  healthHandler,
];
