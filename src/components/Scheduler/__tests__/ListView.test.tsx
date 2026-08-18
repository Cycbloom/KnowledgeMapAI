// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";
import { ListView } from "../ListView";
import type { UserTask, TaskSubtask } from "@shared/types";

// react-i18next：直接返回 key，避免依赖真实 i18n 资源
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

// api mock：仅替换 ListView 依赖的 api.scheduler.getSubtasks / updateSubtask；
// 其余模块（study/graphs/templates 等）保留真实实现——mutations barrel 在模块
// 加载期即解引用 api.study.createCardsBatch 等方法，全量替换会导致 TypeError
const schedulerMock = vi.hoisted(() => ({
  getSubtasks: vi.fn(),
  updateSubtask: vi.fn(),
}));

vi.mock("../../../services/api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../services/api")>();
  return {
    api: new Proxy(actual.api, {
      get: (target, prop, receiver) => {
        if (prop === "scheduler") return schedulerMock;
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

import { api } from "../../../services/api";

const getSubtasksMock = vi.mocked(api.scheduler.getSubtasks);
const updateSubtaskMock = vi.mocked(api.scheduler.updateSubtask);

function makeTask(overrides: Partial<UserTask>): UserTask {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Task 1",
    description: "",
    queue_level: 0,
    position: 0,
    priority: 1,
    status: "pending",
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeSubtask(overrides: Partial<TaskSubtask>): TaskSubtask {
  return {
    id: "sub-1",
    task_id: "task-1",
    title: "Subtask A",
    description: "",
    status: "pending",
    priority: 1,
    position: 0,
    knowledge_point_id: "kp-1",
    learning_state: "learning",
    mastery_level: 50,
    last_state_change_at: "2026-01-01T00:00:00Z",
    state_history: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// @tanstack/react-virtual 通过 element.offsetHeight / offsetWidth 计算滚动容器尺寸
// 与行/卡片尺寸。jsdom 中这两个值默认均为 0，导致 outerSize===0 时虚拟器 range 为
// null、不渲染任何条目。这里 mock 为非零值，使真实虚拟器能在 jsdom 下切出可见窗口。
function mockLayoutMetrics(): void {
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 400,
  });
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 800,
  });
}

function restoreLayoutMetrics(): void {
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  delete proto.offsetHeight;
  delete proto.offsetWidth;
}

beforeEach(() => {
  getSubtasksMock.mockReset();
  updateSubtaskMock.mockReset();
  getSubtasksMock.mockResolvedValue([]);
  updateSubtaskMock.mockResolvedValue(
    makeSubtask({ status: "completed" }),
  );
  mockLayoutMetrics();
});

afterEach(() => {
  restoreLayoutMetrics();
  cleanup();
});

describe("ListView", () => {
  it("渲染任务：首条任务标题出现在文档中", () => {
    const tasks = [
      makeTask({ id: "a", title: "Alpha", created_at: "2026-01-03T00:00:00Z" }),
      makeTask({ id: "b", title: "Beta", created_at: "2026-01-02T00:00:00Z" }),
      makeTask({ id: "c", title: "Gamma", created_at: "2026-01-01T00:00:00Z" }),
    ];

    renderWithProviders(<ListView tasks={tasks} />);

    // 标题在桌面行与移动卡片各渲染一次，因此使用 getAllByText 断言至少出现
    const alphaTitles = screen.getAllByText("Alpha");
    expect(alphaTitles.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gamma").length).toBeGreaterThan(0);
  });

  it("搜索过滤：仅渲染匹配关键词的任务", async () => {
    const tasks = [
      makeTask({ id: "a", title: "Apple", created_at: "2026-01-03T00:00:00Z" }),
      makeTask({
        id: "b",
        title: "Banana",
        created_at: "2026-01-02T00:00:00Z",
      }),
      makeTask({ id: "c", title: "Cherry", created_at: "2026-01-01T00:00:00Z" }),
    ];

    renderWithProviders(<ListView tasks={tasks} />);

    const searchInput = screen.getByRole("textbox");
    fireEvent.change(searchInput, { target: { value: "app" } });

    // 防抖 300ms 后 debouncedQuery 生效，非匹配任务被过滤掉。
    // 以「Banana 消失」作为防抖生效的等待条件（Apple 在过滤前后都存在，无法作为信号）。
    await waitFor(
      () => {
        expect(screen.queryAllByText("Banana")).toHaveLength(0);
      },
      { timeout: 2000 },
    );

    expect(screen.getAllByText("Apple").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Cherry")).toHaveLength(0);
  });

  it("状态过滤：点击状态按钮后仅渲染该状态任务", () => {
    const tasks = [
      makeTask({
        id: "a",
        title: "PendingTask",
        status: "pending",
        created_at: "2026-01-03T00:00:00Z",
      }),
      makeTask({
        id: "b",
        title: "CompletedTask",
        status: "completed",
        created_at: "2026-01-02T00:00:00Z",
      }),
    ];

    renderWithProviders(<ListView tasks={tasks} />);

    // 打开过滤面板
    fireEvent.click(
      screen.getByRole("button", { name: "scheduler.listView.filter" }),
    );

    // 点击 pending 状态过滤按钮（按钮 text = t("scheduler.pending")）
    fireEvent.click(
      screen.getByRole("button", { name: "scheduler.pending" }),
    );

    expect(screen.getAllByText("PendingTask").length).toBeGreaterThan(0);
    expect(screen.queryByText("CompletedTask")).not.toBeInTheDocument();
  });

  it("排序：切换排序后标题顺序符合预期", () => {
    // 打乱顺序传入
    const tasks = [
      makeTask({ id: "a", title: "Tomato", created_at: "2026-01-01T00:00:00Z" }),
      makeTask({ id: "b", title: "Apple", created_at: "2026-01-01T00:00:00Z" }),
      makeTask({ id: "c", title: "Banana", created_at: "2026-01-01T00:00:00Z" }),
      makeTask({ id: "d", title: "Cherry", created_at: "2026-01-01T00:00:00Z" }),
      makeTask({ id: "e", title: "Date", created_at: "2026-01-01T00:00:00Z" }),
    ];

    renderWithProviders(<ListView tasks={tasks} />);

    // 点击桌面表头 "title" 进行升序排序
    fireEvent.click(screen.getByText("scheduler.listView.title"));

    // 桌面表格与移动卡片会各渲染一份标题，且桌面视图在 DOM 中先于移动视图。
    // 取前 count 个（即桌面视图）按 DOM 顺序断言升序。
    const titles = screen
      .getAllByText(/Apple|Banana|Cherry|Date|Tomato/)
      .map((el) => el.textContent);
    const expected = ["Apple", "Banana", "Cherry", "Date", "Tomato"];
    expect(titles.slice(0, tasks.length)).toEqual(expected);
  });

  it("展开子任务：mock getSubtasks 后点击展开显示子任务标题", async () => {
    const subtasks = [makeSubtask({ id: "sub-1", title: "Subtask A" })];
    getSubtasksMock.mockResolvedValue(subtasks);

    const tasks = [
      makeTask({
        id: "t-expand",
        title: "Parent Task",
        has_subtasks: true,
        subtask_count: 1,
        created_at: "2026-01-01T00:00:00Z",
      }),
    ];

    renderWithProviders(<ListView tasks={tasks} />);

    // 桌面行存在展开按钮（aria-controls 指向 row-{id}-detail），移动卡片无展开按钮
    const expandButtons = screen.getAllByRole("button", { expanded: false });
    const expandButton = expandButtons.find(
      (btn) => btn.getAttribute("aria-controls") === "row-t-expand-detail",
    );
    expect(expandButton).toBeDefined();
    if (expandButton) {
      fireEvent.click(expandButton);
    }

    await waitFor(
      () => {
        expect(screen.getByText("Subtask A")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    expect(getSubtasksMock).toHaveBeenCalledWith("t-expand");
  });

  it("虚拟化正确性：仅渲染可见窗口，行数远小于总条数", () => {
    const tasks = Array.from({ length: 60 }, (_, i) =>
      makeTask({
        id: `task-${i}`,
        title: `TaskItem ${i}`,
        created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );

    renderWithProviders(<ListView tasks={tasks} />);

    // 移动与桌面各渲染可见窗口（overscan 内）的任务，绝不可能挂载全部 60 条。
    // 注意：默认按 created_at 降序排序，因此可见窗口内是日期最新的任务，而非 TaskItem 0。
    const renderedTitles = screen.getAllByText(/TaskItem/);
    expect(renderedTitles.length).toBeGreaterThan(0);
    expect(renderedTitles.length).toBeLessThan(60);
  });

  // 说明：第 7 条「单行更新不重渲染整表」未覆盖。
  // 原因：ListView 的行/卡片均包裹在 motion 组件中，且虚拟化下每次状态更新都会触发
  // useVirtualizer 的 measure() 与 getVirtualItems() 重算，桌面/移动两套视图同时渲染，
  // 难以稳定断言「其它行的 DOM 节点未被替换」。此为可选加分项，按任务说明跳过。
});