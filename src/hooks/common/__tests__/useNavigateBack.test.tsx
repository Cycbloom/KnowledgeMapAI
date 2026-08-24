// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { NavigationProvider, useNavigateBack } from "../useNavigateBack";

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  const { goBack } = useNavigateBack();

  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
      <button onClick={() => navigate("/study")}>go-study</button>
      <button onClick={() => navigate("/quiz/123")}>go-quiz</button>
      <button onClick={() => navigate("/quiz/123/practice")}>go-practice</button>
      <button onClick={() => navigate("/study?view=quizzes")}>go-quizlist</button>
      <button onClick={() => goBack()}>back</button>
      <button onClick={() => goBack("/profile")}>back-profile</button>
    </div>
  );
}

const currentSearch = () => screen.getByTestId("search").textContent;

function renderHarness(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NavigationProvider>
        <Harness />
      </NavigationProvider>
    </MemoryRouter>,
  );
}

const currentPath = () => screen.getByTestId("path").textContent;

describe("useNavigateBack", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("返回应逐级回退到上一层页面，不会在两个详情页之间循环", () => {
    renderHarness();

    fireEvent.click(screen.getByText("go-study"));
    fireEvent.click(screen.getByText("go-quiz"));
    fireEvent.click(screen.getByText("go-practice"));
    expect(currentPath()).toBe("/quiz/123/practice");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/quiz/123");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/study");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/");
  });

  it("无应用内历史时应回退到详情页的父级列表", () => {
    renderHarness(["/notes/abc"]);

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/notes");
  });

  it("无应用内历史且提供 fallbackPath 时应使用 fallbackPath", () => {
    renderHarness(["/settings"]);

    fireEvent.click(screen.getByText("back-profile"));
    expect(currentPath()).toBe("/profile");
  });

  it("测验详情返回测验列表后再次返回应回到上一层而非测验详情（带查询参数）", () => {
    renderHarness(["/study"]);

    fireEvent.click(screen.getByText("go-quiz"));
    expect(currentPath()).toBe("/quiz/123");

    fireEvent.click(screen.getByText("go-quizlist"));
    expect(currentPath()).toBe("/study");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/");
  });

  it("练习页返回测验列表后再次返回不应回到练习页", () => {
    renderHarness(["/study"]);

    fireEvent.click(screen.getByText("go-quiz"));
    fireEvent.click(screen.getByText("go-practice"));
    expect(currentPath()).toBe("/quiz/123/practice");

    fireEvent.click(screen.getByText("go-quizlist"));
    expect(currentPath()).toBe("/study");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/");
  });

  it("无应用内历史且无父级时应回退到首页", () => {
    renderHarness(["/study"]);

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/");
  });

  it("返回应还原上一页完整 query（学习模式 → 学习中心 → 返回，应带回首 graph_id/node_id）", () => {
    renderHarness(["/learning?graph_id=abc&node_id=xyz"]);

    fireEvent.click(screen.getByText("go-study"));
    expect(currentPath()).toBe("/study");

    fireEvent.click(screen.getByText("back"));
    expect(currentPath()).toBe("/learning");
    expect(currentSearch()).toBe("?graph_id=abc&node_id=xyz");
  });
});
