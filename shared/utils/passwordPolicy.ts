/**
 * 密码复杂度策略
 *
 * 规则：
 * - 最少 8 个字符
 * - 至少包含一个大写字母
 * - 至少包含一个小写字母
 * - 至少包含一个数字
 * - 至少包含一个特殊字符（可选）
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
}

export function getPasswordRequirements(): PasswordRequirements {
  return {
    minLength: 8,
    requireUpper: true,
    requireLower: true,
    requireDigit: true,
    requireSpecial: true,
  };
}

const REQUIREMENT_MESSAGES: Record<string, { zh: string; en: string }> = {
  minLength: { zh: "至少 8 个字符", en: "At least 8 characters" },
  requireUpper: { zh: "包含大写字母", en: "Contains uppercase letter" },
  requireLower: { zh: "包含小写字母", en: "Contains lowercase letter" },
  requireDigit: { zh: "包含数字", en: "Contains a digit" },
  requireSpecial: { zh: "包含特殊字符", en: "Contains a special character" },
};

export function getRequirementMessages(): Record<string, { zh: string; en: string }> {
  return REQUIREMENT_MESSAGES;
}

/**
 * 校验密码是否符合复杂度策略
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  const reqs = getPasswordRequirements();

  if (!password || password.length < reqs.minLength) {
    errors.push("minLength");
  }
  if (reqs.requireUpper && !/[A-Z]/.test(password)) {
    errors.push("requireUpper");
  }
  if (reqs.requireLower && !/[a-z]/.test(password)) {
    errors.push("requireLower");
  }
  if (reqs.requireDigit && !/\d/.test(password)) {
    errors.push("requireDigit");
  }
  if (reqs.requireSpecial && !/[^a-zA-Z0-9]/.test(password)) {
    errors.push("requireSpecial");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 检查密码是否满足指定规则的单项
 */
export function checkRequirement(password: string, key: keyof PasswordRequirements): boolean {
  switch (key) {
    case "minLength":
      return password.length >= 8;
    case "requireUpper":
      return /[A-Z]/.test(password);
    case "requireLower":
      return /[a-z]/.test(password);
    case "requireDigit":
      return /\d/.test(password);
    case "requireSpecial":
      return /[^a-zA-Z0-9]/.test(password);
    default:
      return false;
  }
}