// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { SearchInput } from "../SearchInput";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";

const StatefulHarness = ({ children }: { children: (value: string, onChange: (v: string) => void) => React.ReactNode }) => {
  const [value, setValue] = useState("");
  return <>{children(value, setValue)}</>;
};

describe("SearchInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("渲染搜索图标与受控输入框（role=searchbox）", () => {
    renderWithProviders(
      <StatefulHarness>
        {(value, onChange) => (
          <SearchInput value={value} onChange={onChange} placeholder="搜索笔记" />
        )}
      </StatefulHarness>,
    );
    const input = screen.getByRole("searchbox");
    expect(input).toBeVisible();
    expect(input).toHaveAttribute("placeholder", "搜索笔记");
    expect(screen.getByLabelText("搜索")).toBeVisible();
  });

  it("输入触发 onChange", () => {
    const onChange = vi.fn();
    renderWithProviders(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "概念" } });
    expect(onChange).toHaveBeenCalledWith("概念");
  });

  it("value 非空时显示清除按钮，点击后调用 onChange('') 与 onClear", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    const { rerender } = renderWithProviders(
      <SearchInput value="概念" onChange={onChange} onClear={onClear} ariaLabel="clear-test" />,
    );
    expect(screen.getByLabelText("clear-test")).toBeTruthy();
    const clearButton = screen.getByLabelText("清除");
    fireEvent.click(clearButton);
    // rerender 以体现受控清空后按钮隐藏
    rerender(<SearchInput value="" onChange={onChange} onClear={onClear} ariaLabel="clear-test" />);
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("清除")).not.toBeInTheDocument();
  });

  it("value 为空时不渲染清除按钮", () => {
    renderWithProviders(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByLabelText("清除")).not.toBeInTheDocument();
  });

  it("allowClear=false 时即使有内容也不渲染清除按钮", () => {
    renderWithProviders(<SearchInput value="内容" onChange={() => {}} allowClear={false} />);
    expect(screen.queryByLabelText("清除")).not.toBeInTheDocument();
  });

  it("透传 onKeyDown", () => {
    const onKeyDown = vi.fn();
    renderWithProviders(<SearchInput value="" onChange={() => {}} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});