import { describe, it, expect } from "vitest";
import {
  validateRequired,
  validateEmail,
  validateMinLength,
  validateMaxLength,
  validateUrl,
  validateNumberRange,
  validatePattern,
  composeValidators,
} from "../validators";

describe("validators", () => {
  describe("validateRequired", () => {
    it("空字符串应该返回默认错误 key", () => {
      expect(validateRequired("")).toBe("form.validation.required");
    });

    it("纯空白字符串应该返回默认错误 key", () => {
      expect(validateRequired("  ")).toBe("form.validation.required");
    });

    it("有值时应该通过校验", () => {
      expect(validateRequired("value")).toBeUndefined();
    });

    it("空字符串传入自定义 message 应该返回自定义 message", () => {
      expect(validateRequired("", "custom.required")).toBe("custom.required");
    });

    it("纯空白字符串传入自定义 message 应该返回自定义 message", () => {
      expect(validateRequired("  ", "custom.required")).toBe("custom.required");
    });

    it("有值时传入自定义 message 应该通过校验", () => {
      expect(validateRequired("value", "custom.required")).toBeUndefined();
    });
  });

  describe("validateEmail", () => {
    it("无效邮箱应该返回默认错误 key", () => {
      expect(validateEmail("invalid")).toBe("form.validation.emailInvalid");
    });

    it("合法邮箱应该通过校验", () => {
      expect(validateEmail("user@example.com")).toBeUndefined();
    });

    it("空字符串应该通过校验（让 required 处理必填）", () => {
      expect(validateEmail("")).toBeUndefined();
    });

    it("无效邮箱传入自定义 message 应该返回自定义 message", () => {
      expect(validateEmail("invalid", "custom.email")).toBe("custom.email");
    });

    it("合法邮箱传入自定义 message 应该通过校验", () => {
      expect(
        validateEmail("user@example.com", "custom.email"),
      ).toBeUndefined();
    });
  });

  describe("validateMinLength", () => {
    it("长度不足应该返回默认错误 key", () => {
      expect(validateMinLength("ab", 3)).toBe("form.validation.minLength");
    });

    it("长度等于最小值应该通过校验", () => {
      expect(validateMinLength("abc", 3)).toBeUndefined();
    });

    it("长度超过最小值应该通过校验", () => {
      expect(validateMinLength("abcd", 3)).toBeUndefined();
    });

    it("空字符串应该通过校验（让 required 处理必填）", () => {
      expect(validateMinLength("", 3)).toBeUndefined();
    });

    it("长度不足传入自定义 message 应该返回自定义 message", () => {
      expect(validateMinLength("ab", 3, "custom.min")).toBe("custom.min");
    });
  });

  describe("validateMaxLength", () => {
    it("长度超过最大值应该返回默认错误 key", () => {
      expect(validateMaxLength("abc", 2)).toBe("form.validation.maxLength");
    });

    it("长度等于最大值应该通过校验", () => {
      expect(validateMaxLength("ab", 2)).toBeUndefined();
    });

    it("长度小于最大值应该通过校验", () => {
      expect(validateMaxLength("a", 2)).toBeUndefined();
    });

    it("空字符串应该通过校验（让 required 处理必填）", () => {
      expect(validateMaxLength("", 2)).toBeUndefined();
    });

    it("长度超过传入自定义 message 应该返回自定义 message", () => {
      expect(validateMaxLength("abc", 2, "custom.max")).toBe("custom.max");
    });
  });

  describe("validateUrl", () => {
    it("非 URL 应该返回默认错误 key", () => {
      expect(validateUrl("not-url")).toBe("form.validation.urlInvalid");
    });

    it("https URL 应该通过校验", () => {
      expect(validateUrl("https://example.com")).toBeUndefined();
    });

    it("http URL 应该通过校验", () => {
      expect(validateUrl("http://example.com")).toBeUndefined();
    });

    it("空字符串应该通过校验（让 required 处理必填）", () => {
      expect(validateUrl("")).toBeUndefined();
    });

    it("非 URL 传入自定义 message 应该返回自定义 message", () => {
      expect(validateUrl("not-url", "custom.url")).toBe("custom.url");
    });
  });

  describe("validateNumberRange", () => {
    it("值在范围内应该通过校验", () => {
      expect(validateNumberRange(5, 1, 10)).toBeUndefined();
    });

    it("值超出范围应该返回默认错误 key", () => {
      expect(validateNumberRange(15, 1, 10)).toBe(
        "form.validation.numberRange",
      );
    });

    it("值低于范围应该返回默认错误 key", () => {
      expect(validateNumberRange(0, 1, 10)).toBe(
        "form.validation.numberRange",
      );
    });

    it("仅传 min 时值小于 min 应该返回默认错误 key", () => {
      expect(validateNumberRange(0, 1)).toBe("form.validation.numberRange");
    });

    it("仅传 min 时值等于 min 应该通过校验", () => {
      expect(validateNumberRange(1, 1)).toBeUndefined();
    });

    it("仅传 min 时值大于 min 应该通过校验", () => {
      expect(validateNumberRange(5, 1)).toBeUndefined();
    });

    it("仅传 max 时值大于 max 应该返回默认错误 key", () => {
      expect(validateNumberRange(5, undefined, 3)).toBe(
        "form.validation.numberRange",
      );
    });

    it("仅传 max 时值等于 max 应该通过校验", () => {
      expect(validateNumberRange(3, undefined, 3)).toBeUndefined();
    });

    it("仅传 max 时值小于 max 应该通过校验", () => {
      expect(validateNumberRange(1, undefined, 3)).toBeUndefined();
    });

    it("不传 min/max 应该通过校验（无约束）", () => {
      expect(validateNumberRange(5)).toBeUndefined();
    });

    it("超出范围传入自定义 message 应该返回自定义 message", () => {
      expect(validateNumberRange(15, 1, 10, "custom.range")).toBe(
        "custom.range",
      );
    });
  });

  describe("validatePattern", () => {
    it("不匹配正则应该返回默认错误 key", () => {
      expect(validatePattern("abc", /^\d+$/)).toBe(
        "form.validation.patternMismatch",
      );
    });

    it("匹配正则应该通过校验", () => {
      expect(validatePattern("123", /^\d+$/)).toBeUndefined();
    });

    it("不匹配正则传入自定义 message 应该返回自定义 message", () => {
      expect(validatePattern("abc", /^\d+$/, "custom.pattern")).toBe(
        "custom.pattern",
      );
    });

    it("匹配正则传入自定义 message 应该通过校验", () => {
      expect(validatePattern("123", /^\d+$/, "custom.pattern")).toBeUndefined();
    });
  });

  describe("composeValidators", () => {
    it("第一个校验失败应该返回第一个错误", () => {
      const composed = composeValidators(validateRequired, validateEmail);
      expect(composed("")).toBe("form.validation.required");
    });

    it("第一个通过第二个失败应该返回第二个错误", () => {
      const composed = composeValidators(validateRequired, validateEmail);
      expect(composed("invalid")).toBe("form.validation.emailInvalid");
    });

    it("全部通过应该返回 undefined", () => {
      const composed = composeValidators(validateRequired, validateEmail);
      expect(composed("user@example.com")).toBeUndefined();
    });

    it("无校验器应该通过校验", () => {
      const composed = composeValidators();
      expect(composed("anything")).toBeUndefined();
    });

    it("应该按顺序返回第一个错误（多个校验器）", () => {
      const minLenValidator = (value: string) => validateMinLength(value, 5);
      const composed = composeValidators(
        validateRequired,
        minLenValidator,
        validateEmail,
      );
      // 短字符串先触发 minLength
      expect(composed("ab")).toBe("form.validation.minLength");
    });
  });
});
