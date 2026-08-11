import { describe, it, expect } from "vitest";
import {
  validatePassword,
  checkRequirement,
  getPasswordRequirements,
  getRequirementMessages,
  type PasswordRequirements,
} from "../passwordPolicy";

describe("getPasswordRequirements", () => {
  it("返回符合 PasswordRequirements 结构的配置", () => {
    const reqs = getPasswordRequirements();
    expect(typeof reqs.minLength).toBe("number");
    expect(typeof reqs.requireUpper).toBe("boolean");
    expect(typeof reqs.requireLower).toBe("boolean");
    expect(typeof reqs.requireDigit).toBe("boolean");
    expect(typeof reqs.requireSpecial).toBe("boolean");
    expect(reqs.minLength).toBe(8);
    expect(reqs.requireUpper).toBe(true);
    expect(reqs.requireLower).toBe(true);
    expect(reqs.requireDigit).toBe(true);
    expect(reqs.requireSpecial).toBe(true);
  });
});

describe("validatePassword", () => {
  it("强密码通过校验", () => {
    const result = validatePassword("Abcdef123!");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("过短密码返回 minLength 错误", () => {
    const result = validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minLength");
  });

  it("缺少大写字母时返回 requireUpper 错误", () => {
    const result = validatePassword("abcdef123!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("requireUpper");
  });

  it("缺少小写字母时返回 requireLower 错误", () => {
    const result = validatePassword("ABCDEF123!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("requireLower");
  });

  it("缺少数字时返回 requireDigit 错误", () => {
    const result = validatePassword("Abcdefgh!");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("requireDigit");
  });

  it("缺少特殊字符时返回 requireSpecial 错误", () => {
    const result = validatePassword("Abcdef123");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("requireSpecial");
  });

  it("空字符串返回 minLength 错误", () => {
    const result = validatePassword("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minLength");
  });

  it("同时缺失多项时返回对应的多个错误", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4);
    expect(result.errors).toEqual(["minLength", "requireUpper", "requireDigit", "requireSpecial"]);
  });
});

describe("checkRequirement", () => {
  it.each([
    ["minLength", "12345678", true],
    ["minLength", "1234567", false],
    ["requireUpper", "Abcdef1!", true],
    ["requireUpper", "abcdef1!", false],
    ["requireLower", "Abcdef1!", true],
    ["requireLower", "ABCDEF1!", false],
    ["requireDigit", "Abcdef1!", true],
    ["requireDigit", "Abcdefgh!", false],
    ["requireSpecial", "Abcdef1!", true],
    ["requireSpecial", "Abcdefgh1", false],
  ] as [keyof PasswordRequirements, string, boolean][])(
    "key=%s password=%s 返回 %s",
    (key, password, expected) => {
      expect(checkRequirement(password, key)).toBe(expected);
    }
  );

  it("未知 key 返回 false", () => {
    // @ts-expect-error 传入非法的 key 以验证默认分支
    expect(checkRequirement("Abcdef1!", "unknownKey")).toBe(false);
  });
});

describe("getRequirementMessages", () => {
  it("返回的键集合与 requirements 一致", () => {
    const reqs = getPasswordRequirements();
    const messages = getRequirementMessages();
    const reqKeys = Object.keys(reqs).sort();
    const msgKeys = Object.keys(messages).sort();
    expect(msgKeys).toEqual(reqKeys);
  });

  it("中文结构完整", () => {
    const messages = getRequirementMessages();
    expect(Object.keys(messages).length).toBe(5);
    expect(messages.minLength).toEqual({ zh: "至少 8 个字符", en: "At least 8 characters" });
    expect(messages.requireUpper).toEqual({ zh: "包含大写字母", en: "Contains uppercase letter" });
    expect(messages.requireLower).toEqual({ zh: "包含小写字母", en: "Contains lowercase letter" });
    expect(messages.requireDigit).toEqual({ zh: "包含数字", en: "Contains a digit" });
    expect(messages.requireSpecial).toEqual({ zh: "包含特殊字符", en: "Contains a special character" });
  });

  it("每条消息均包含 zh 与 en 字段", () => {
    const messages = getRequirementMessages();
    for (const key of Object.keys(messages)) {
      expect(messages[key]).toHaveProperty("zh");
      expect(messages[key]).toHaveProperty("en");
      expect(typeof messages[key].zh).toBe("string");
      expect(typeof messages[key].en).toBe("string");
    }
  });
});