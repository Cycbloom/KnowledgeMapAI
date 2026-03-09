import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, createNodeSchema } from '../../schemas/index';

describe('API Schemas', () => {
  describe('Auth Schemas', () => {
    it('should validate correct register data', () => {
      const data = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User'
      };
      expect(registerSchema.safeParse(data).success).toBe(true);
    });

    it('should fail invalid register email', () => {
      const data = {
        email: 'invalid-email',
        password: 'Password123',
        name: 'Test User'
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('邮箱格式不正确');
      }
    });

    it('should fail password without uppercase', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message === '密码需要包含大写字母')).toBe(true);
      }
    });

    it('should validate correct login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };
      expect(loginSchema.safeParse(data).success).toBe(true);
    });
  });

  describe('Node Schemas', () => {
    it('should validate correct create node data', () => {
      const data = {
        graph_id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'New Node',
        level: 'root'
      };
      expect(createNodeSchema.safeParse(data).success).toBe(true);
    });

    it('should fail if graph_id is not uuid', () => {
      const data = {
        graph_id: 'invalid-uuid',
        title: 'New Node'
      };
      const result = createNodeSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('无效的图谱ID');
      }
    });
  });
});
