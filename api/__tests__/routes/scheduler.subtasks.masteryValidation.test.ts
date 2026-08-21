import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const updateSubtaskBodySchema = z.object({
  title: z.string().min(1, "标题不能为空").optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  priority: z.number().int().min(0).optional(),
  estimated_duration: z.number().int().min(0).optional(),
  actual_duration: z.number().int().min(0).optional(),
  due_date: z.string().datetime().optional().nullable(),
  learning_state: z
    .enum(["learning", "review", "practice", "quiz"])
    .optional(),
  mastery_level: z.number().min(0).max(1).optional(),
});

const transitionSubtaskBodySchema = z.object({
  to_state: z.enum(["learning", "review", "practice", "quiz"]),
  mastery_level: z.number().min(0).max(1),
  reason: z.string().optional(),
});

const masteryPatchBodySchema = z.object({
  mastery_level: z.number().min(0).max(1),
});

function expectValidationError<T>(schema: z.ZodSchema<T>, payload: unknown) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.length).toBeGreaterThan(0);
    return result.error.issues;
  }
  return [];
}

function expectValidationSuccess<T>(schema: z.ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(true);
  expect(result.success ? result.data : undefined).toBeDefined();
  return result.success ? (result.data as T) : (undefined as never);
}

describe('scheduler/subtasks zod mastery_level validation (0~1 decimal)', () => {
  describe('updateSubtaskBodySchema', () => {
    it('accepts mastery_level: 0.56 (valid decimal 0~1)', () => {
      const parsed = expectValidationSuccess(updateSubtaskBodySchema, {
        title: 'test',
        mastery_level: 0.56,
      });
      expect(parsed.mastery_level).toBe(0.56);
    });

    it('rejects mastery_level: 56 (old integer percent, returns 422-style issue)', () => {
      const issues = expectValidationError(updateSubtaskBodySchema, {
        title: 'test',
        mastery_level: 56,
      });
      expect(issues.some((i) => i.code === 'too_big' || i.message.includes('1'))).toBe(true);
    });

    it('accepts mastery_level: 0 (boundary low)', () => {
      const parsed = expectValidationSuccess(updateSubtaskBodySchema, {
        mastery_level: 0,
      });
      expect(parsed.mastery_level).toBe(0);
    });

    it('accepts mastery_level: 1 (boundary high)', () => {
      const parsed = expectValidationSuccess(updateSubtaskBodySchema, {
        mastery_level: 1,
      });
      expect(parsed.mastery_level).toBe(1);
    });

    it('rejects mastery_level: -0.01', () => {
      expectValidationError(updateSubtaskBodySchema, { mastery_level: -0.01 });
    });

    it('rejects mastery_level: 1.01', () => {
      expectValidationError(updateSubtaskBodySchema, { mastery_level: 1.01 });
    });
  });

  describe('transitionSubtaskBodySchema', () => {
    it('accepts valid payload with mastery_level: 0.56', () => {
      const parsed = expectValidationSuccess(transitionSubtaskBodySchema, {
        to_state: 'review',
        mastery_level: 0.56,
      });
      expect(parsed.mastery_level).toBe(0.56);
      expect(parsed.to_state).toBe('review');
    });

    it('rejects payload with mastery_level: 56 (old percent integer)', () => {
      const issues = expectValidationError(transitionSubtaskBodySchema, {
        to_state: 'practice',
        mastery_level: 56,
      });
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('masteryPatchBodySchema', () => {
    it('accepts {mastery_level: 0.56}', () => {
      const parsed = expectValidationSuccess(masteryPatchBodySchema, {
        mastery_level: 0.56,
      });
      expect(parsed.mastery_level).toBe(0.56);
    });

    it('rejects {mastery_level: 56} with validation issue (client should receive 422)', () => {
      const issues = expectValidationError(masteryPatchBodySchema, {
        mastery_level: 56,
      });
      expect(issues.length).toBeGreaterThan(0);
      const masteryIssue = issues.find((i) =>
        (i.path as unknown[]).includes('mastery_level'),
      );
      expect(masteryIssue).toBeDefined();
    });
  });
});
