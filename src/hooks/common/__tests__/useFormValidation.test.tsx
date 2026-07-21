// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FormEvent } from "react";
import { useFormValidation } from "../useFormValidation";

interface FormValues {
  email: string;
  password: string;
  [key: string]: string;
}

const initialValues: FormValues = {
  email: "",
  password: "",
};

const validate = (values: FormValues): Partial<Record<keyof FormValues, string>> => {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.email) {
    errors.email = "form.validation.emailRequired";
  } else if (!values.email.includes("@")) {
    errors.email = "form.validation.emailInvalid";
  }
  if (!values.password) {
    errors.password = "form.validation.passwordRequired";
  } else if (values.password.length < 6) {
    errors.password = "form.validation.passwordMinLength";
  }
  return errors;
};

describe("useFormValidation", () => {
  beforeEach(() => {
    vi.spyOn(document, "querySelector").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("初始状态应该为空 errors / 空 touched / isSubmitting=false / values=initialValues", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.values).toEqual(initialValues);
  });

  it("handleChange 更新值且字段未 touched 时不应触发校验", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleChange("email", "invalid");
    });

    expect(result.current.values.email).toBe("invalid");
    // 未 touched 不校验，errors 仍为空
    expect(result.current.errors).toEqual({});
  });

  it("handleChange 更新值且字段已 touched 时应该重新校验", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    // 先 blur 标记 touched
    act(() => {
      result.current.handleBlur("email");
    });

    // 再 change，此时已 touched 应触发校验
    act(() => {
      result.current.handleChange("email", "invalid");
    });

    expect(result.current.values.email).toBe("invalid");
    expect(result.current.errors.email).toBe("form.validation.emailInvalid");
  });

  it("handleBlur 应该标记 touched 并触发校验", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    // 先通过 handleChange 把 email 设置为无效值（未 touched 不校验）
    act(() => {
      result.current.handleChange("email", "invalid");
    });

    expect(result.current.errors).toEqual({});

    // 调用 handleBlur 标记 touched 并校验
    act(() => {
      result.current.handleBlur("email");
    });

    expect(result.current.touched.email).toBe(true);
    expect(result.current.errors.email).toBe("form.validation.emailInvalid");
  });

  it("handleSubmit 有错误时应该标记所有字段 touched 且不调用 onSubmit", async () => {
    const scrollIntoView = vi.fn();
    vi.mocked(document.querySelector).mockReturnValue({
      scrollIntoView,
    } as unknown as Element);

    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    // 所有字段标记 touched
    expect(result.current.touched.email).toBe(true);
    expect(result.current.touched.password).toBe(true);
    // errors 含所有无效字段
    expect(result.current.errors.email).toBe("form.validation.emailRequired");
    expect(result.current.errors.password).toBe("form.validation.passwordRequired");
    // onSubmit 未被调用
    expect(onSubmit).not.toHaveBeenCalled();
    // 滚动到首个错误
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    // isSubmitting 保持 false
    expect(result.current.isSubmitting).toBe(false);
  });

  it("handleSubmit 全部通过时应该调用 onSubmit 并完成 isSubmitting 生命周期", async () => {
    const onSubmit = vi.fn();
    const validValues: FormValues = {
      email: "valid@example.com",
      password: "password123",
    };

    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: validValues,
        validate,
        onSubmit,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(validValues);
    // 完成后 isSubmitting 应为 false
    expect(result.current.isSubmitting).toBe(false);
  });

  it("handleSubmit 异步 onSubmit 时 isSubmitting 应在 await 期间为 true，resolve 后为 false", async () => {
    let resolveOnSubmit: () => void = () => {};
    const onSubmitPromise = new Promise<void>((resolve) => {
      resolveOnSubmit = resolve;
    });
    const onSubmit = vi.fn(() => onSubmitPromise);

    const validValues: FormValues = {
      email: "valid@example.com",
      password: "password123",
    };

    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: validValues,
        validate,
        onSubmit,
      }),
    );

    // 启动 handleSubmit（不 await）
    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = result.current.handleSubmit();
    });

    // onSubmit 调用后但未 resolve 前，isSubmitting 应为 true
    expect(result.current.isSubmitting).toBe(true);

    // resolve onSubmit，等待 handleSubmit 完成
    await act(async () => {
      resolveOnSubmit();
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("setFieldError 应该设置 errors 并标记 touched", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    act(() => {
      result.current.setFieldError("email", "backend.emailTaken");
    });

    expect(result.current.errors.email).toBe("backend.emailTaken");
    expect(result.current.touched.email).toBe(true);
  });

  it("reset 应该恢复 values 到 initialValues 并清空 errors / touched / isSubmitting", () => {
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit: vi.fn(),
      }),
    );

    // 修改 values、产生 errors、touched
    act(() => {
      result.current.handleBlur("email");
    });
    act(() => {
      result.current.handleChange("email", "invalid");
    });

    expect(result.current.values.email).toBe("invalid");
    expect(result.current.errors.email).toBeDefined();
    expect(result.current.touched.email).toBe(true);

    // 调用 reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });

  it("SSR 安全：document.querySelector 返回 null 时 handleSubmit 不应抛错", async () => {
    // querySelector 已在 beforeEach 中 mock 为返回 null
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useFormValidation({
        initialValues,
        validate,
        onSubmit,
      }),
    );

    await expect(
      act(async () => {
        await result.current.handleSubmit();
      }),
    ).resolves.toBeUndefined();

    // onSubmit 不应被调用（因为有校验错误）
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("handleSubmit 传入 event 时应该调用 preventDefault", async () => {
    const preventDefault = vi.fn();
    const onSubmit = vi.fn();
    const validValues: FormValues = {
      email: "valid@example.com",
      password: "password123",
    };

    const { result } = renderHook(() =>
      useFormValidation({
        initialValues: validValues,
        validate,
        onSubmit,
      }),
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault,
      } as unknown as FormEvent);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
