// @vitest-environment jsdom
/**
 * BlockEditor 集成测试 (Task 3.5)
 *
 * 测试范围:
 * - 加载笔记内容(初始 content 同步 + 已保存状态)
 * - 编辑触发自动保存(失焦立即保存 + 无变更跳过)
 * - 写作辅助(续写/改写/扩写)浮层:选中 -> 请求 -> 建议展示
 * - Daily 笔记刷新今日数据聚合
 *
 * TipTap/ProseMirror 在 jsdom 中无法完整渲染,故 mock @tiptap/react 模块,
 * 仅测试 BlockEditor 包装层的逻辑(save/load/AI/toolbar 状态)。
 * 通过 MSW 拦截 HTTP 请求,验证 mutation 实际触发的 API 调用。
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, fireEvent, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../../../tests/setup/mswServer";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";
import i18n from "../../../i18n";

// ============================================================
// Mock TipTap —— jsdom 不支持 ProseMirror 完整渲染
// ============================================================

interface MockSelection {
  empty: boolean;
  from: number;
  to: number;
  $from: {
    depth: number;
    parent: {
      type: { name: string };
      isTextblock: boolean;
      textContent: string;
      nodeSize: number;
    };
    parentOffset: number;
    start: () => number;
    pos: number;
    before: () => number;
  };
}

interface MockEditor {
  isDestroyed: boolean;
  state: {
    selection: MockSelection;
    doc: {
      content: { size: number };
      textContent: string;
      textBetween: (from: number, to: number, sep: string) => string;
      descendants: (cb: (node: unknown, pos: number) => boolean | void) => boolean;
      forEach: (cb: (child: unknown, offset: number, index: number) => void) => void;
    };
  };
  view: {
    dom: HTMLDivElement;
    coordsAtPos: (pos: number) => {
      left: number;
      top: number;
      right: number;
      bottom: number;
    };
  };
  storage: {
    markdown: { getMarkdown: () => string };
    blockEmbed: { currentNoteId: string | undefined };
  };
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  chain: () => MockChain;
  commands: { setContent: ReturnType<typeof vi.fn> };
  isActive: ReturnType<typeof vi.fn>;
  can: ReturnType<typeof vi.fn>;
  // 测试辅助方法(挂在 __mock 命名空间下避免与真实 Editor 类型冲突)
  __mock: {
    emit: (event: string) => void;
    setMarkdown: (md: string) => void;
    setSelection: (empty: boolean, from?: number, to?: number, text?: string) => void;
  };
}

interface MockChain {
  focus: () => MockChain;
  toggleBold: () => MockChain;
  toggleItalic: () => MockChain;
  toggleStrike: () => MockChain;
  toggleCode: () => MockChain;
  undo: () => MockChain;
  redo: () => MockChain;
  deleteRange: () => MockChain;
  deleteSelection: () => MockChain;
  setTextSelection: () => MockChain;
  insertContent: () => MockChain;
  insertContentAt: () => MockChain;
  setImage: () => MockChain;
  insertBlockEmbed: () => MockChain;
  insertBlockReference: () => MockChain;
  run: () => MockEditor;
}

const createMockEditor = (): MockEditor => {
  const listeners: Record<string, Array<() => void>> = {};
  let markdown = "";
  let selectedText = "";

  const chain: MockChain = {
    focus: () => chain,
    toggleBold: () => chain,
    toggleItalic: () => chain,
    toggleStrike: () => chain,
    toggleCode: () => chain,
    undo: () => chain,
    redo: () => chain,
    deleteRange: () => chain,
    deleteSelection: () => chain,
    setTextSelection: () => chain,
    insertContent: () => chain,
    insertContentAt: () => chain,
    setImage: () => chain,
    insertBlockEmbed: () => chain,
    insertBlockReference: () => chain,
    run: () => mockEditor,
  };

  const mockEditor: MockEditor = {
    isDestroyed: false,
    state: {
      selection: {
        empty: true,
        from: 0,
        to: 0,
        $from: {
          depth: 1,
          parent: {
            type: { name: "paragraph" },
            isTextblock: true,
            textContent: "",
            nodeSize: 1,
          },
          parentOffset: 0,
          start: () => 0,
          pos: 0,
          before: () => 0,
        },
      },
      doc: {
        content: { size: 0 },
        textContent: "",
        textBetween: () => selectedText,
        descendants: () => false,
        forEach: () => {},
      },
    },
    view: {
      dom: document.createElement("div"),
      coordsAtPos: () => ({ left: 0, top: 0, right: 100, bottom: 20 }),
    },
    storage: {
      markdown: { getMarkdown: () => markdown },
      blockEmbed: { currentNoteId: undefined as string | undefined },
    },
    on: vi.fn((event: string, handler: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return mockEditor;
    }),
    off: vi.fn((event: string, handler: () => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
      return mockEditor;
    }),
    chain: () => chain,
    commands: {
      setContent: vi.fn((content: string) => {
        markdown = content;
        return mockEditor;
      }),
    },
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({
      toggleBold: () => true,
      toggleItalic: () => true,
      toggleStrike: () => true,
      toggleCode: () => true,
      undo: () => false,
      redo: () => false,
    })),
    __mock: {
      emit: (event: string) => {
        (listeners[event] ?? []).forEach((h) => h());
      },
      setMarkdown: (md: string) => {
        markdown = md;
      },
      setSelection: (empty: boolean, from = 0, to = 0, text = "") => {
        mockEditor.state.selection.empty = empty;
        mockEditor.state.selection.from = from;
        mockEditor.state.selection.to = to;
        selectedText = text;
        mockEditor.state.doc.content.size = to;
      },
    },
  };

  return mockEditor;
};

// 当前测试可访问的 mock editor 实例(由 useEditor mock 创建)
let currentMockEditor: MockEditor | null = null;

vi.mock("@tiptap/react", () => ({
  useEditor: () => {
    if (!currentMockEditor) {
      currentMockEditor = createMockEditor();
    }
    return currentMockEditor;
  },
  EditorContent: ({ editor }: { editor: MockEditor | null }) => {
    const ref = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (node && editor) {
          // 将 editor.view.dom 挂载到渲染容器内,使 focusout 事件可触发
          if (!node.contains(editor.view.dom)) {
            node.appendChild(editor.view.dom);
          }
        }
      },
      [editor],
    );
    return <div data-testid="tiptap-editor" ref={ref} />;
  },
}));

// Mock editorExtensions:跳过真实 TipTap 扩展加载
vi.mock("../../../components/Notes/editorExtensions", () => ({
  buildEditorExtensions: () => [],
}));

// Mock markdownSerializer:跳过 wiki 链接/块引用预处理
vi.mock("../../../components/Notes/markdownSerializer", () => ({
  markdownToTiptap: (content: string) => content,
  tiptapToMarkdown: (content: string) => content,
  buildWikiLinkHref: (title: string) => `wiki://${title}`,
}));

// Mock blockMovement:跳过 ProseMirror 节点交换逻辑
vi.mock("../../../components/Notes/blockMovement", () => ({
  canMoveBlock: () => ({ up: false, down: false }),
  moveBlock: () => {},
}));

// Mock useNodeTitles:避免 react-query 拉取知识点列表
vi.mock("../../../components/Notes/WikiLinkPopover", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../../components/Notes/WikiLinkPopover")
  >();
  return {
    ...actual,
    useNodeTitles: () => ({
      data: [],
      isLoading: false,
      refetch: () => Promise.resolve({ data: [] }),
    }),
  };
});

import { BlockEditor } from "../../../components/Notes/BlockEditor";

// ============================================================
// 测试常量
// ============================================================

const TEST_NOTE_ID = "test-note-id-123";
const INITIAL_CONTENT = "# 测试笔记\n\n初始内容";

// ============================================================
// 测试
// ============================================================

describe("BlockEditor 集成测试", () => {
  beforeEach(async () => {
    currentMockEditor = null;
    // 测试断言使用中文标签,强制切换到 zh-CN 避免 jsdom 中 localStorage 缺失导致回退到 en-US
    await i18n.changeLanguage("zh-CN");
  });

  // ============================================================
  // 1. 加载笔记
  // ============================================================
  it("应加载笔记并渲染工具栏与已保存状态", () => {
    renderWithProviders(
      <BlockEditor
        noteId={TEST_NOTE_ID}
        initialContent={INITIAL_CONTENT}
        noteType="note"
      />,
    );

    // 工具栏格式化按钮应渲染
    expect(screen.getByLabelText("粗体")).toBeInTheDocument();
    expect(screen.getByLabelText("斜体")).toBeInTheDocument();
    expect(screen.getByLabelText("撤销")).toBeInTheDocument();

    // 底部状态栏应显示"已保存"(初始 saveStatus = "saved")
    expect(screen.getByText("已保存")).toBeInTheDocument();

    // 编辑器容器应渲染
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  // ============================================================
  // 2. 编辑后失焦触发保存
  // ============================================================
  it("编辑后失焦应触发 PUT /api/v1/notes/:id 保存请求", async () => {
    const updateFn = vi.fn();
    server.use(
      http.put(`/api/v1/notes/${TEST_NOTE_ID}`, async ({ request }) => {
        updateFn(await request.json());
        return HttpResponse.json({
          id: TEST_NOTE_ID,
          userId: "test-user",
          title: "Test Note",
          content: INITIAL_CONTENT,
          type: "note",
          date: null,
          templateId: null,
          tags: [],
          isPinned: false,
          isArchived: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          deletedAt: null,
        });
      }),
    );

    renderWithProviders(
      <BlockEditor
        noteId={TEST_NOTE_ID}
        initialContent={INITIAL_CONTENT}
        noteType="note"
      />,
    );

    const editor = currentMockEditor;
    if (!editor) {
      throw new Error("mock editor 未初始化");
    }

    // 模拟用户编辑:更新 markdown 并触发 update 事件(调度防抖保存)
    editor.__mock.setMarkdown("# 测试笔记\n\n修改后的内容");
    editor.__mock.emit("update");

    // 触发失焦(focusout 冒泡到 editor.view.dom)以立即保存
    fireEvent(editor.view.dom, new Event("focusout", { bubbles: true }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith({
        content: "# 测试笔记\n\n修改后的内容",
      });
    });
  });

  // ============================================================
  // 3. 无变更时不触发保存
  // ============================================================
  it("内容未变更时失焦不应触发保存请求", async () => {
    const updateFn = vi.fn();
    server.use(
      http.put(`/api/v1/notes/${TEST_NOTE_ID}`, async ({ request }) => {
        updateFn(await request.json());
        return HttpResponse.json({
          id: TEST_NOTE_ID,
          userId: "u",
          title: "t",
          content: INITIAL_CONTENT,
          type: "note",
          date: null,
          templateId: null,
          tags: [],
          isPinned: false,
          isArchived: false,
          createdAt: "",
          updatedAt: "",
          deletedAt: null,
        });
      }),
    );

    renderWithProviders(
      <BlockEditor
        noteId={TEST_NOTE_ID}
        initialContent={INITIAL_CONTENT}
        noteType="note"
      />,
    );

    // 未编辑直接触发失焦
    const editor = currentMockEditor;
    if (!editor) {
      throw new Error("mock editor 未初始化");
    }
    fireEvent(editor.view.dom, new Event("focusout", { bubbles: true }));

    // 等待潜在异步保存（包裹 act 以处理失焦期间可能触发的 React 状态更新）
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(updateFn).not.toHaveBeenCalled();
  });

  // ============================================================
  // 4. 写作辅助:选中文本 -> 点击续写 -> 显示 AI 建议
  // ============================================================
  it("写作辅助:选中文本后点击续写应调用 writing-assist 端点并显示建议", async () => {
    const assistFn = vi.fn();
    server.use(
      http.post(`/api/v1/notes/${TEST_NOTE_ID}/writing-assist`, async ({ request }) => {
        assistFn(await request.json());
        return HttpResponse.json({ suggestion: "AI 续写建议内容" });
      }),
    );

    renderWithProviders(
      <BlockEditor
        noteId={TEST_NOTE_ID}
        initialContent={INITIAL_CONTENT}
        noteType="note"
      />,
    );

    const editor = currentMockEditor;
    if (!editor) {
      throw new Error("mock editor 未初始化");
    }

    // 初始状态:续写按钮应禁用(无选区)
    const continueButton = screen.getByLabelText("续写");
    expect(continueButton).toBeDisabled();

    // 模拟用户选中文本
    editor.__mock.setSelection(false, 0, 5, "选中文本");
    editor.__mock.emit("selectionUpdate");

    // 选区出现后,续写按钮应启用
    await waitFor(() => {
      expect(screen.getByLabelText("续写")).not.toBeDisabled();
    });

    // 点击续写
    fireEvent.click(screen.getByLabelText("续写"));

    // 应调用 writing-assist 端点
    await waitFor(() => {
      expect(assistFn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "continue",
          selectedText: "选中文本",
        }),
      );
    });

    // 应弹出写作辅助浮层并显示 AI 建议
    await waitFor(() => {
      expect(screen.getByText("AI 续写建议内容")).toBeInTheDocument();
    });

    // 浮层应显示采纳/放弃按钮
    expect(screen.getByText("采纳")).toBeInTheDocument();
    expect(screen.getByText("放弃")).toBeInTheDocument();
  });

  // ============================================================
  // 5. Daily 笔记刷新今日数据聚合
  // ============================================================
  it("daily 笔记点击刷新今日数据应调用 refresh-aggregation 端点", async () => {
    const refreshFn = vi.fn();
    server.use(
      http.post(`/api/v1/notes/${TEST_NOTE_ID}/refresh-aggregation`, () => {
        refreshFn();
        return HttpResponse.json({
          note: {
            id: TEST_NOTE_ID,
            userId: "u",
            title: "Daily",
            content: "## 今日数据\n\n已刷新内容",
            type: "daily",
            date: "2026-07-07",
            templateId: null,
            tags: [],
            isPinned: false,
            isArchived: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            deletedAt: null,
          },
          refreshed: true,
        });
      }),
    );

    renderWithProviders(
      <BlockEditor
        noteId={TEST_NOTE_ID}
        initialContent={INITIAL_CONTENT}
        noteType="daily"
      />,
    );

    // daily 类型应显示"刷新今日数据"按钮
    const refreshButton = screen.getByLabelText("刷新今日数据");
    expect(refreshButton).toBeInTheDocument();

    // 点击刷新
    fireEvent.click(refreshButton);

    // 应调用 refresh-aggregation 端点
    await waitFor(() => {
      expect(refreshFn).toHaveBeenCalled();
    });
  });
});
