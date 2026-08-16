// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FirstRunHint } from "../FirstRunHint";

// 每个用例开始前重置 localStorage mock 的 getItem 返回值，避免用例间串扰。
// 全局 afterEach 已调用 vi.clearAllMocks() 清空调用记录，但 mockReturnValue
// 会保留，因此这里显式把 getItem 控制为默认返回 null。
beforeEach(() => {
  (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
    null,
  );
});

describe("FirstRunHint", () => {
  it("首次显示：渲染容器、标题、描述与 dismiss 按钮", () => {
    render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        description="描述"
        dismissLabel="知道了"
      />,
    );
    expect(screen.getByTestId("first-run-hint")).toBeInTheDocument();
    expect(screen.getByText("标题")).toBeInTheDocument();
    expect(screen.getByText("描述")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "知道了" }),
    ).toBeInTheDocument();
  });

  it("dismiss 后隐藏并持久化到 localStorage", () => {
    render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "知道了" }));
    expect(screen.queryByTestId("first-run-hint")).toBeNull();
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "test-hint",
      "true",
    );
  });

  it("已 dismiss（本地标记为 true）时不再显示", () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      "true",
    );
    render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
      />,
    );
    expect(screen.queryByTestId("first-run-hint")).toBeNull();
  });

  it("placement='top' 时箭头朝上，包含 border-b-8 与 border-b-primary-600", () => {
    const { container } = render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
        placement="top"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain("border-b-8");
    expect(html).toContain("border-b-primary-600");
  });

  it("placement='bottom'（默认）时箭头朝下，包含 border-t-8 与 border-t-primary-600", () => {
    const { container } = render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain("border-t-8");
    expect(html).toContain("border-t-primary-600");
  });

  it("受控 visible=false 时不渲染，visible=true 时渲染", () => {
    const { unmount } = render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
        visible={false}
      />,
    );
    expect(screen.queryByTestId("first-run-hint")).toBeNull();
    unmount();

    render(
      <FirstRunHint
        storageKey="test-hint"
        title="标题"
        dismissLabel="知道了"
        visible={true}
      />,
    );
    expect(screen.getByTestId("first-run-hint")).toBeInTheDocument();
  });
});