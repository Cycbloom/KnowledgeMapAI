// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { focusFirstError } from "../focusFirstError";

describe("focusFirstError", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("container 为 null 时返回 false 且不抛错", () => {
    expect(focusFirstError(null)).toBe(false);
  });

  it("没有 [aria-invalid=\"true\"] 元素时返回 false", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input value="ok" />';
    document.body.appendChild(container);

    expect(focusFirstError(container)).toBe(false);

    container.remove();
  });

  it("错误标记的可聚焦 input 自身被聚焦、滚动到可见位置并返回 true", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input aria-invalid="true" />';
    document.body.appendChild(container);

    const input = container.querySelector("input") as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    const scrollSpy = vi.spyOn(input, "scrollIntoView");

    expect(focusFirstError(container)).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });

    container.remove();
  });

  it("aria-invalid 在包裹元素上时聚焦内部 input 并返回 true", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div data-testid="wrapper" aria-invalid="true"><input value="" /></div>';
    document.body.appendChild(container);

    const input = container.querySelector("input") as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    const scrollSpy = vi.spyOn(input, "scrollIntoView");

    expect(focusFirstError(container)).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();

    container.remove();
  });

  it("错误标记元素不可聚焦且无可聚焦后代时返回 false 且不抛错", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div aria-invalid="true"><span>plain text</span></div>';
    document.body.appendChild(container);

    expect(focusFirstError(container)).toBe(false);

    container.remove();
  });

  it("存在多个错误标记控件时聚焦并返回文档顺序中的第一个", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div aria-invalid="true"><label>first: <input id="first" value="" /></label></div>' +
      '<div aria-invalid="true"><label>second: <input id="second" value="" /></label></div>';
    document.body.appendChild(container);

    const first = container.querySelector("#first") as HTMLInputElement;
    const second = container.querySelector("#second") as HTMLInputElement;
    const firstFocusSpy = vi.spyOn(first, "focus");
    const secondFocusSpy = vi.spyOn(second, "focus");

    expect(focusFirstError(container)).toBe(true);
    expect(firstFocusSpy).toHaveBeenCalled();
    expect(secondFocusSpy).not.toHaveBeenCalled();

    container.remove();
  });
});