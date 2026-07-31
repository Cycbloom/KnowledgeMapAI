import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@shared/types/user';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from '@shared/types/api';
import { AppError, SharedErrorCodes } from '../../../utils/errors';
import { createMockSupabase } from '../../../../tests/helpers/mockFactories';

// --- Mocks ---

// Mock logger to suppress console output during tests
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock request function from ./client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// Mock getSupabaseClient from @/lib/supabase
vi.mock('../../../utils/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

// Mock authConfig to control isSupabase() branch
vi.mock('../../../config/authConfig', () => ({
  authConfig: {
    isSupabase: vi.fn(),
  },
}));

// --- Imports (must be after vi.mock declarations) ---

import { authApi } from '../auth';
import { request } from '../client';
import { getSupabaseClient } from '../../../utils/supabase';
import { authConfig } from '../../../config/authConfig';

// --- Types & Helpers ---

/** Mock Supabase client with all auth methods used by supabaseAuthApi. */
interface AuthMockClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
  };
}

const mockUser = { id: 'user-1', email: 'test@example.com' } as unknown as User;

const mockSession = {
  access_token: 'access-token-123',
  refresh_token: 'refresh-token-123',
  expires_in: 3600,
};

const registerData: RegisterData = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
};

const loginData: LoginData = {
  email: 'test@example.com',
  password: 'password123',
};

const profileData: UpdateProfileData = {
  name: 'Updated Name',
};

/**
 * Creates a mock Supabase client with all auth methods needed by supabaseAuthApi.
 * Uses createMockSupabase as the base (provides getUser, signInWithPassword,
 * signOut) and adds the missing signUp, updateUser, refreshSession methods.
 */
function createAuthMockClient(): AuthMockClient {
  const client = createMockSupabase() as unknown as AuthMockClient;
  client.auth.signUp = vi.fn();
  client.auth.updateUser = vi.fn();
  client.auth.refreshSession = vi.fn();
  return client;
}

/** Sets up getSupabaseClient to return the given mock client. */
function setSupabaseClient(client: AuthMockClient): void {
  vi.mocked(getSupabaseClient).mockReturnValue(
    client as unknown as SupabaseClient,
  );
}

// --- Tests ---

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // 1. localAuthApi 分支（isSupabase() 返回 false）
  // ============================================================
  describe('localAuthApi 分支（isSupabase() 返回 false）', () => {
    beforeEach(() => {
      vi.mocked(authConfig.isSupabase).mockReturnValue(false);
    });

    it('应该通过 POST /auth/register 注册用户', async () => {
      const mockResponse: AuthResponse = { user: mockUser, session: null };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.register(registerData);

      expect(request).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 POST /auth/login 登录用户', async () => {
      const mockResponse: AuthResponse = { user: mockUser, session: null };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.login(loginData);

      expect(request).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData),
      });
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 POST /auth/logout 登出用户', async () => {
      const mockResponse = { message: '登出成功' };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.logout();

      expect(request).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 GET /auth/user 获取用户信息', async () => {
      const mockResponse = { user: mockUser };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.getUser();

      expect(request).toHaveBeenCalledWith('/auth/user');
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 PUT /auth/profile 更新用户资料', async () => {
      const mockResponse = { user: mockUser };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.updateProfile(profileData);

      expect(request).toHaveBeenCalledWith('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 POST /auth/refresh 刷新令牌', async () => {
      const mockResponse: AuthResponse = { user: mockUser, session: null };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await authApi.refreshToken('refresh-token-123');

      expect(request).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-token-123' }),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  // ============================================================
  // 2. supabaseAuthApi 分支（isSupabase() 返回 true）
  // ============================================================
  describe('supabaseAuthApi 分支（isSupabase() 返回 true）', () => {
    beforeEach(() => {
      vi.mocked(authConfig.isSupabase).mockReturnValue(true);
    });

    it('应该调用 supabase.auth.signUp 注册用户并映射会话字段', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authApi.register(registerData);

      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: registerData.email,
        password: registerData.password,
        options: { data: { name: registerData.name } },
      });
      expect(result).toEqual({
        user: mockUser,
        session: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'bearer',
        },
      });
    });

    it('应该在 expires_in 为 0 时默认使用 3600', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signUp.mockResolvedValue({
        data: {
          user: mockUser,
          session: { ...mockSession, expires_in: 0 },
        },
        error: null,
      });

      const result = await authApi.register(registerData);

      expect(result.session).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        token_type: 'bearer',
      });
    });

    it('应该在 session 为 null 时返回 null session', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const result = await authApi.register(registerData);

      expect(result).toEqual({ user: mockUser, session: null });
    });

    it('应该调用 supabase.auth.signInWithPassword 登录用户并映射会话字段', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authApi.login(loginData);

      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: loginData.email,
        password: loginData.password,
      });
      expect(result).toEqual({
        user: mockUser,
        session: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'bearer',
        },
      });
    });

    it('应该调用 supabase.auth.signOut 登出并返回成功消息', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signOut.mockResolvedValue({ error: null });

      const result = await authApi.logout();

      expect(client.auth.signOut).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: '登出成功' });
    });

    it('应该调用 supabase.auth.getUser 获取用户信息', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authApi.getUser();

      expect(client.auth.getUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ user: mockUser });
    });

    it('应该调用 supabase.auth.updateUser 更新用户资料', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await authApi.updateProfile(profileData);

      expect(client.auth.updateUser).toHaveBeenCalledWith({ data: profileData });
      expect(result).toEqual({ user: mockUser });
    });

    it('应该调用 supabase.auth.refreshSession 刷新令牌并映射会话字段', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.refreshSession.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authApi.refreshToken('refresh-token-123');

      expect(client.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token-123',
      });
      expect(result).toEqual({
        user: mockUser,
        session: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
          token_type: 'bearer',
        },
      });
    });
  });

  // ============================================================
  // 3. Supabase 客户端未初始化（getSupabaseClient 返回 null）
  // ============================================================
  describe('Supabase 客户端未初始化（getSupabaseClient 返回 null）', () => {
    beforeEach(() => {
      vi.mocked(authConfig.isSupabase).mockReturnValue(true);
      vi.mocked(getSupabaseClient).mockReturnValue(null);
    });

    it('应该在 register 时抛出 AppError（SYSTEM_CONFIGURATION_ERROR, 500）', async () => {
      const promise = authApi.register(registerData);
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
        statusCode: 500,
      });
    });

    it('应该在 login 时抛出 AppError（SYSTEM_CONFIGURATION_ERROR, 500）', async () => {
      const promise = authApi.login(loginData);
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
        statusCode: 500,
      });
    });

    it('应该在 getUser 时抛出 AppError（SYSTEM_CONFIGURATION_ERROR, 500）', async () => {
      const promise = authApi.getUser();
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
        statusCode: 500,
      });
    });

    it('应该在 updateProfile 时抛出 AppError（SYSTEM_CONFIGURATION_ERROR, 500）', async () => {
      const promise = authApi.updateProfile(profileData);
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
        statusCode: 500,
      });
    });

    it('应该在 refreshToken 时抛出 AppError（SYSTEM_CONFIGURATION_ERROR, 500）', async () => {
      const promise = authApi.refreshToken('refresh-token-123');
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR,
        statusCode: 500,
      });
    });

    it('应该在 logout 时不抛出异常并返回成功消息', async () => {
      const result = await authApi.logout();
      expect(result).toEqual({ message: '登出成功' });
    });
  });

  // ============================================================
  // 4. Supabase 认证错误处理
  // ============================================================
  describe('Supabase 认证错误处理', () => {
    beforeEach(() => {
      vi.mocked(authConfig.isSupabase).mockReturnValue(true);
    });

    it('应该在 register 出错时返回 { user: null, error }', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: '注册失败' },
      });

      const result = await authApi.register(registerData);

      expect(result).toEqual({ user: null, error: '注册失败' });
    });

    it('应该在 login 出错时返回 { user: null, error }', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: '登录失败' },
      });

      const result = await authApi.login(loginData);

      expect(result).toEqual({ user: null, error: '登录失败' });
    });

    it('应该在 refreshToken 出错时返回 { user: null, error }', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: '刷新失败' },
      });

      const result = await authApi.refreshToken('refresh-token-123');

      expect(result).toEqual({ user: null, error: '刷新失败' });
    });

    it('应该在 updateProfile 出错时抛出 AppError（DATABASE_QUERY_ERROR, 500）', async () => {
      const client = createAuthMockClient();
      setSupabaseClient(client);
      client.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: '更新失败' },
      });

      const promise = authApi.updateProfile(profileData);
      await expect(promise).rejects.toBeInstanceOf(AppError);
      await expect(promise).rejects.toMatchObject({
        code: SharedErrorCodes.DATABASE_QUERY_ERROR,
        statusCode: 500,
        message: '更新失败',
      });
    });
  });
});
