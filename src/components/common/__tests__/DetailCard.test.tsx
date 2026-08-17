// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailCard } from "../DetailCard";
import { DetailStatCard } from "../DetailStatCard";

describe("DetailCard", () => {
  it("渲染 children 内容", () => {
    render(
      <DetailCard>
        <span>body content</span>
      </DetailCard>,
    );
    expect(screen.getByText("body content")).toBeVisible();
  });

  it("渲染标题文本", () => {
    render(<DetailCard title="卡片标题">content</DetailCard>);
    expect(screen.getByText("卡片标题")).toBeVisible();
  });

  it("渲染图标节点", () => {
    render(
      <DetailCard icon={<svg data-testid="detail-icon" />}>content</DetailCard>,
    );
    expect(screen.getByTestId("detail-icon")).toBeInTheDocument();
  });

  it("传入 action 时渲染 action", () => {
    render(
      <DetailCard action={<button type="button">编辑</button>}>content</DetailCard>,
    );
    expect(screen.getByRole("button", { name: "编辑" })).toBeVisible();
  });

  it("未提供 title/icon/action 时不渲染标题栏，但内容仍然渲染", () => {
    render(<DetailCard>仅内容</DetailCard>);
    expect(screen.getByText("仅内容")).toBeVisible();
    // 标题栏容器仅在存在 title/icon/action 时渲染，这里应不存在
    expect(
      document.querySelector(".flex.items-center.gap-2.mb-2"),
    ).not.toBeInTheDocument();
  });

  it("应用 className 与 bodyClassName", () => {
    render(
      <DetailCard
        className="bg-slate-900 border-slate-700"
        bodyClassName="mt-4"
      >
        content
      </DetailCard>,
    );
    const wrapper = document.querySelector(".rounded-xl");
    expect(wrapper).toHaveClass("bg-slate-900", "border-slate-700");
    expect(wrapper?.querySelector(".mt-4")).toBeInTheDocument();
  });
});

describe("DetailStatCard", () => {
  it("渲染 label 与 value", () => {
    render(<DetailStatCard label="已掌握" value={12} />);
    expect(screen.getByText("已掌握")).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
  });

  it("渲染 icon", () => {
    render(
      <DetailStatCard
        label="已掌握"
        value={1}
        icon={<svg data-testid="stat-icon" />}
      />,
    );
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
  });

  it("应用 valueClassName 与 className", () => {
    render(
      <DetailStatCard
        label="已掌握"
        value={3}
        className="bg-slate-900"
        valueClassName="text-3xl text-green-400"
      />,
    );
    const wrapper = document.querySelector(".rounded-xl");
    expect(wrapper).toHaveClass("bg-slate-900");
    expect(wrapper?.querySelector(".text-3xl")).toHaveClass("text-green-400");
  });
});