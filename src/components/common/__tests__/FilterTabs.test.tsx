// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterTabs } from "../FilterTabs";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";

describe("FilterTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const items = [
    { value: "all", label: "全部", count: 12 },
    { value: "done", label: "已完成" },
    { value: "pending", label: "进行中", count: 3 },
  ];

  it("渲染全部标签并标记选中项 aria-selected=true", () => {
    renderWithProviders(<FilterTabs items={items} value="all" onChange={() => {}} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("全部")).toBeVisible();
  });

  it("仅对提供 count 的项渲染数量徽标", () => {
    renderWithProviders(<FilterTabs items={items} value="all" onChange={() => {}} />);
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    // "已完成" 无 count
    const doneTab = screen.getByText("已完成");
    expect(doneTab.textContent).not.toContain("/");
  });

  it("点击标签触发 onChange 携带该项 value", () => {
    const onChange = vi.fn();
    renderWithProviders(<FilterTabs items={items} value="all" onChange={onChange} />);
    fireEvent.click(screen.getByText("已完成"));
    expect(onChange).toHaveBeenCalledWith("done");
  });

  it("role=tablist 容器存在", () => {
    renderWithProviders(<FilterTabs items={items} value="all" onChange={() => {}} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("未提供 count 的项后跟随其余项计数不串位（普通渲染 smoke）", () => {
    const { container } = render(<FilterTabs items={items} value="pending" onChange={() => {}} />);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
  });
});