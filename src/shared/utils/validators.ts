export type ValidationResult = string | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/.+/;

export function validateRequired(
  value: string,
  message?: string,
): ValidationResult {
  if (value.trim() === "") {
    return message ?? "form.validation.required";
  }
  return undefined;
}

export function validateEmail(
  value: string,
  message?: string,
): ValidationResult {
  if (value === "") {
    return undefined;
  }
  if (!EMAIL_PATTERN.test(value)) {
    return message ?? "form.validation.emailInvalid";
  }
  return undefined;
}

export function validateMinLength(
  value: string,
  min: number,
  message?: string,
): ValidationResult {
  if (value === "") {
    return undefined;
  }
  if (value.length < min) {
    return message ?? "form.validation.minLength";
  }
  return undefined;
}

export function validateMaxLength(
  value: string,
  max: number,
  message?: string,
): ValidationResult {
  if (value === "") {
    return undefined;
  }
  if (value.length > max) {
    return message ?? "form.validation.maxLength";
  }
  return undefined;
}

export function validateUrl(
  value: string,
  message?: string,
): ValidationResult {
  if (value === "") {
    return undefined;
  }
  if (!URL_PATTERN.test(value)) {
    return message ?? "form.validation.urlInvalid";
  }
  return undefined;
}

export function validateNumberRange(
  value: number,
  min?: number,
  max?: number,
  message?: string,
): ValidationResult {
  if (min !== undefined && value < min) {
    return message ?? "form.validation.numberRange";
  }
  if (max !== undefined && value > max) {
    return message ?? "form.validation.numberRange";
  }
  return undefined;
}

export function validatePattern(
  value: string,
  pattern: RegExp,
  message?: string,
): ValidationResult {
  if (!pattern.test(value)) {
    return message ?? "form.validation.patternMismatch";
  }
  return undefined;
}

export function composeValidators(
  ...validators: ((value: string) => ValidationResult)[]
): (value: string) => ValidationResult {
  return (value: string): ValidationResult => {
    for (const validator of validators) {
      const result = validator(value);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  };
}
