import { useCallback, useState, type FormEvent } from "react";

export interface UseFormValidationOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validate: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void> | void;
}

export interface UseFormValidationResult<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  handleChange: <K extends keyof T>(field: K, value: T[K]) => void;
  handleBlur: <K extends keyof T>(field: K) => void;
  handleSubmit: (event?: FormEvent) => Promise<void>;
  reset: () => void;
  setFieldError: <K extends keyof T>(field: K, error: string) => void;
}

/**
 * 滚动到第一个错误字段。
 * - SSR 环境（window 未定义）静默跳过
 * - 未找到错误元素时静默跳过
 */
function scrollToFirstError(): void {
  if (typeof window === "undefined") return;
  document.querySelector('[aria-invalid="true"]')?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

/**
 * 表单校验 hook。
 *
 * - 基于 useState 管理 values / errors / touched / isSubmitting
 * - handleChange 仅在字段已 touched 时重新校验（避免未交互字段提前报错）
 * - handleBlur 标记 touched 并立即校验当前值
 * - handleSubmit 全量校验：有错误时标记所有字段 touched 并滚动到首个错误，
 *   无错误时调用 onSubmit 并管理 isSubmitting 生命周期
 * - SSR 安全：scrollToFirstError 在 window 未定义时不执行
 *
 * @example
 * const { values, errors, handleChange, handleBlur, handleSubmit } = useFormValidation({
 *   initialValues: { email: "", password: "" },
 *   validate: (v) => {
 *     const e: Partial<Record<keyof typeof v, string>> = {};
 *     if (!v.email) e.email = "form.validation.emailRequired";
 *     return e;
 *   },
 *   onSubmit: async (v) => { await api.login(v); },
 * });
 */
export function useFormValidation<T extends Record<string, unknown>>(
  options: UseFormValidationOptions<T>,
): UseFormValidationResult<T> {
  const { initialValues, validate, onSubmit } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    <K extends keyof T>(field: K, value: T[K]): void => {
      const nextValues = { ...values, [field]: value };
      setValues(nextValues);
      if (touched[field]) {
        setErrors(validate(nextValues));
      }
    },
    [values, touched, validate],
  );

  const handleBlur = useCallback(
    <K extends keyof T>(field: K): void => {
      setTouched({ ...touched, [field]: true });
      setErrors(validate(values));
    },
    [values, touched, validate],
  );

  const handleSubmit = useCallback(
    async (event?: FormEvent): Promise<void> => {
      if (event) {
        event.preventDefault();
      }

      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        const allTouched = Object.keys(values).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {} as Partial<Record<keyof T, boolean>>,
        );
        setTouched(allTouched);
        scrollToFirstError();
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, onSubmit],
  );

  const reset = useCallback((): void => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const setFieldError = useCallback(
    <K extends keyof T>(field: K, error: string): void => {
      setErrors((prev) => ({ ...prev, [field]: error }));
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    [],
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError,
  };
}
