// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { Routes, Route } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";

import { renderWithProviders, resetStores } from "../../../../tests/helpers/renderWithProviders";
import { server } from "../../../../tests/setup/mswServer";
import { useStore } from "../../../../src/store/useStore";

// Import the initialized i18n instance (NOT a side-effect-only import) so we
// can force the language to zh-CN. jsdom's navigator.language defaults to
// en-US, which would make i18next fall back to English translations and break
// assertions on Chinese labels like "编辑" / "添加节点" / "编辑节点".
import i18n from "../../../../src/i18n";

import { GraphEditor } from "../../../../src/pages/GraphEditor";

// Preload the lazy-loaded GraphSidebarManager module so that React.lazy
// resolves instantly during tests. In coverage mode (v8 provider), the
// instrumentation overhead on dynamic import() is significant enough that
// the lazy chunk may not finish loading within the 30s testTimeout, causing
// findByPlaceholderText("输入节点标题") to time out. A static import forces
// the module (and its transitive deps) to load during test-file module
// evaluation — which has no per-test timeout — so the subsequent
// lazy(() => import(...)) inside GraphEditor hits the module cache and
// resolves as an already-fulfilled promise. The real component is kept
// (no stubbing) to preserve integration-test value.
import "../../../../src/components/GraphEditor/sidebar/GraphSidebarManager";

// ============================================================
// Mocks: canvas components that rely on Three.js / WebGL are
// replaced with lightweight DOM stubs so we can test the UI
// controls (toolbar, sidebar, forms) in jsdom.
// ============================================================

// MindMapCanvas — stub that renders each node as a clickable button.
// Uses createElement (not JSX) inside the async factory to avoid
// hoisting / scope issues with vi.mock.
vi.mock("../../../../src/components/GraphEditor/canvas/MindMapCanvas", async () => {
  const { forwardRef, createElement } = await import("react");

  interface MockCanvasProps {
    nodes: Array<{ id: string; title?: string }>;
    onNodeClick?: (node: unknown) => void;
  }

  const MindMapCanvasMock = forwardRef<unknown, MockCanvasProps>(
    (props, _ref) =>
      createElement(
        "div",
        { "data-testid": "mindmap-canvas-mock" },
        props.nodes.map((node) =>
          createElement(
            "button",
            {
              key: node.id,
              "data-testid": `node-${node.id}`,
              onClick: () => props.onNodeClick?.(node),
            },
            node.title ?? "Untitled",
          ),
        ),
      ),
  );
  MindMapCanvasMock.displayName = "MindMapCanvasMock";
  return { MindMapCanvas: MindMapCanvasMock };
});

// OnboardingGuide — suppress the onboarding overlay so it doesn't
// intercept clicks. isOnboardingComplete returns true so the guide
// never renders.
vi.mock("../../../../src/components/GraphEditor/OnboardingGuide", () => ({
  OnboardingGuide: () => null,
  isOnboardingComplete: () => true,
  startOnboardingTour: vi.fn(),
}));

// createPersistedStore — replace persist-based stores with plain zustand
// stores. The persist middleware crashes in jsdom because partialize is
// explicitly set to undefined (see createPersistedStore.ts line 24).
// Using plain create() avoids the persist middleware entirely.
vi.mock("../../../../src/store/createPersistedStore", async () => {
  const { create } = await import("zustand");
  type StateCreator<T> = (
    set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => void,
    get: () => T,
  ) => T;
  return {
    createPersistedStore: <T,>(
      _name: string,
      stateCreator: StateCreator<T>,
    ) => create<T>()(stateCreator),
    migrateLegacyKeys: () => {},
  };
});

// ============================================================
// Test data
// ============================================================

const TEST_GRAPH_ID = "test-graph-123";
const TEST_USER_ID = "test-user-123";

const mockGraph = {
  id: TEST_GRAPH_ID,
  title: "测试图谱",
  user_id: TEST_USER_ID,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  is_favorite: false,
};

const mockNodes = [
  {
    id: "node-1",
    graph_id: TEST_GRAPH_ID,
    knowledge_point_id: "kp-1",
    title: "测试节点一",
    content: "",
    level: "normal" as const,
    is_accepted: true,
    x_position: 0,
    y_position: 0,
    visibility: "private" as const,
    owner_id: TEST_USER_ID,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "node-2",
    graph_id: TEST_GRAPH_ID,
    knowledge_point_id: "kp-2",
    title: "测试节点二",
    content: "",
    level: "normal" as const,
    is_accepted: true,
    x_position: 100,
    y_position: 100,
    visibility: "private" as const,
    owner_id: TEST_USER_ID,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const mockGraphData = {
  nodes: mockNodes,
  edges: [],
  nodeStatus: {},
};

// ============================================================
// Helpers
// ============================================================

/**
 * Wrap the GraphEditor in a Route with /graph/:id so that useParams
 * extracts the graph id correctly.
 */
function graphEditorWrapper(ui: ReactElement): ReactElement {
  return (
    <Routes>
      <Route path="/graph/:id" element={ui} />
    </Routes>
  );
}

function renderGraphEditor() {
  return renderWithProviders(<GraphEditor />, {
    initialEntries: [`/graph/${TEST_GRAPH_ID}`],
    wrapper: graphEditorWrapper,
  });
}

/**
 * Install MSW handlers returning the standard mock graph data.
 * Call server.use(...) to override per-test.
 */
function setupGraphHandlers() {
  server.use(
    http.get(`/api/graphs/${TEST_GRAPH_ID}`, () =>
      HttpResponse.json(mockGraph),
    ),
    http.get(`/api/graphs/${TEST_GRAPH_ID}/nodes`, () =>
      HttpResponse.json(mockGraphData),
    ),
    http.get("/api/graphs/:id/nodes", () =>
      HttpResponse.json(mockGraphData),
    ),
    http.get("/api/graphs/:id", () => HttpResponse.json(mockGraph)),
    http.get("/api/ai/status", () =>
      HttpResponse.json({ enabled: true }),
    ),
  );
}

// ============================================================
// Tests
// ============================================================

describe("GraphEditor Integration", () => {
  beforeEach(() => {
    resetStores();
    // Force Chinese translations so toolbar/sidebar labels match the
    // assertion strings in the tests below.
    i18n.changeLanguage("zh-CN");
    // Authenticate so the editor is NOT in read-only mode
    useStore.setState({
      token: "mock-token",
      user: { id: TEST_USER_ID, email: "test@test.com" },
    });
    setupGraphHandlers();
  });

  it("shows a loading indicator while fetching graph data", () => {
    // Use a delayed response so the loading state is observable
    server.use(
      http.get(`/api/graphs/${TEST_GRAPH_ID}/nodes`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return HttpResponse.json(mockGraphData);
      }),
      http.get(`/api/graphs/${TEST_GRAPH_ID}`, () =>
        HttpResponse.json(mockGraph),
      ),
    );

    const { getByText } = renderGraphEditor();
    expect(getByText("正在加载数据...")).toBeInTheDocument();
  });

  it("displays the graph title and nodes after loading", async () => {
    const { findByText, getByTestId } = renderGraphEditor();

    // Graph title appears in the toolbar
    expect(await findByText("测试图谱")).toBeInTheDocument();

    // Nodes are rendered in the (mocked) canvas
    const canvas = getByTestId("mindmap-canvas-mock");
    expect(canvas).toBeInTheDocument();
    expect(await findByText("测试节点一")).toBeInTheDocument();
    expect(await findByText("测试节点二")).toBeInTheDocument();
  });

  it("opens the create-node sidebar form when clicking add node", async () => {
    const { findByText, getByText, findByPlaceholderText } = renderGraphEditor();

    // Wait for data to load
    await findByText("测试节点一");

    // Open the edit dropdown — the button label is "编辑" (toolbar.edit)
    const editButton = getByText("编辑");
    fireEvent.click(editButton);

    // Click "添加节点" (toolbar.addNode)
    const addNodeItem = await findByText("添加节点");
    fireEvent.click(addNodeItem);

    // The NodeEditSidebar should now be visible with a title input.
    // Use findBy* because GraphSidebarManager is lazy-loaded (React.lazy)
    // and may still be resolving when the click lands.
    const titleInput = await findByPlaceholderText("输入节点标题");
    expect(titleInput).toBeInTheDocument();
  });

  it("opens the detail sidebar when a node is clicked", async () => {
    const { findByText, getByTestId } = renderGraphEditor();

    // Wait for data to load
    await findByText("测试节点一");

    // Click a node in the mocked canvas
    const nodeButton = getByTestId("node-node-1");
    fireEvent.click(nodeButton);

    // The detail sidebar should show the node title and an edit button
    // NodeDetailSidebar renders the title and a "编辑节点" button
    const editNodeButton = await findByText("编辑节点");
    expect(editNodeButton).toBeInTheDocument();
  });

  it("shows a delete confirmation modal when deleting a selected node", async () => {
    const { findByText, getByTestId, getByTitle } = renderGraphEditor();

    // Wait for data to load
    await findByText("测试节点一");

    // Select a node
    const nodeButton = getByTestId("node-node-1");
    fireEvent.click(nodeButton);

    // Wait for detail sidebar
    await findByText("编辑节点");

    // Click the delete button (icon button with title="删除节点")
    const deleteButton = getByTitle("删除节点");
    fireEvent.click(deleteButton);

    // Confirmation modal should appear with the node title in the message
    const confirmMessage = await findByText(/确定要从当前图谱移除节点/);
    expect(confirmMessage).toBeInTheDocument();

    // The ConfirmationModal confirm button uses confirmText="删除"
    const deleteConfirm = await findByText("删除");
    expect(deleteConfirm).toBeInTheDocument();
  });
});
