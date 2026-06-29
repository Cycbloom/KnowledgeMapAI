import { type Request, type Response, type NextFunction } from 'express';
import { getSupabaseAdmin, getSupabaseAnon, createClientWithToken } from '../supabase';
import { type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppError } from './errorHandler';
import { ErrorCodes, type ErrorCode } from '../../shared/types/errorCodes';
import { cacheService } from '../services/common/cacheService';
import { jwtService } from '../services/auth/jwtService';

export type AuthRequest = Request;

export interface AuthedRequest extends Request {
  user: User;
  supabase: SupabaseClient;
}

/**
 * OptionalAuthRequest: 用于 optionalAuth 路由的请求类型。
 *
 * 与 AuthedRequest 不同，OptionalAuthRequest 显式声明 user 和 supabase 为可选，
 * 反映未认证场景下的真实运行时状态。受 optionalAuth 保护的路由 handler 必须使用
 * req.user?.id / req.supabase! 形式进行防御性访问。
 *
 * 由于 Request 全局声明将 user/supabase 设为非可选（以避免 requireAuth 路由的
 * 海量类型修正），OptionalAuthRequest 通过 Omit + 交集重新声明这两个字段为可选。
 */
export type OptionalAuthRequest = Omit<Request, 'user' | 'supabase'> & {
  user?: User;
  supabase?: SupabaseClient;
};

interface TokenError {
  message: string;
  status: number;
  code: ErrorCode;
}

const parseTokenError = (error: { message?: string }): TokenError => {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('expired')) {
    return {
      message: 'Token has expired',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_EXPIRED,
    };
  }

  if (message.includes('invalid') || message.includes('malformed')) {
    return {
      message: 'Invalid token format',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_INVALID,
    };
  }

  if (message.includes('revoked') || message.includes('banned')) {
    return {
      message: 'Token has been revoked',
      status: 401,
      code: ErrorCodes.AUTH_TOKEN_REVOKED,
    };
  }

  return {
    message: 'Token verification failed',
    status: 401,
    code: ErrorCodes.AUTH_TOKEN_INVALID,
  };
};

/**
 * 公共 JWT 验证逻辑：本地 JWT 验证 → user 缓存 → 远程 Supabase 验证。
 *
 * - 验证成功返回 `{ user, supabaseClient }`
 * - 远程验证返回 error 时抛出 AppError（携带具体错误码，由调用方决定是否捕获）
 * - 远程验证无 error 但无 user 时返回 null（由调用方决定如何处理）
 *
 * 注意：revoked token 检查不在此方法内，由 requireAuth 单独处理（optionalAuth
 * 历史行为不做 revoked 检查，保持行为等价）。
 */
async function verifyAndCacheUser(
  token: string,
): Promise<{ user: User; supabaseClient: SupabaseClient } | null> {
  // Step 1: 尝试本地 JWT 验证（无网络开销）
  const localPayload = jwtService.verifySupabaseToken(token);
  const cacheKey = localPayload ? `auth:user:${localPayload.sub}` : null;

  // Step 2: 命中缓存则复用 user（仅本地验证成功时有缓存键）
  if (cacheKey) {
    const cached = await cacheService.get<User>(cacheKey);
    if (cached) {
      return { user: cached, supabaseClient: createClientWithToken(token) };
    }
  }

  // Step 3: 缓存未命中或本地验证失败，远程验证
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);

  if (error) {
    const tokenError = parseTokenError(error);
    throw new AppError(tokenError.message, tokenError.status, tokenError.code);
  }

  if (!user) {
    return null;
  }

  // 写缓存，TTL 5 分钟（仅本地验证成功时缓存）
  if (cacheKey) {
    await cacheService.set(cacheKey, user, 300);
  }

  return { user, supabaseClient: createClientWithToken(token) };
}

export const requireAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError('Authorization header missing', 401, ErrorCodes.AUTH_HEADER_MISSING);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AppError('Invalid authorization header format', 401, ErrorCodes.AUTH_HEADER_MISSING);
  }

  const token = parts[1];

  if (!token) {
    throw new AppError('Token missing', 401, ErrorCodes.AUTH_TOKEN_MISSING);
  }

  // Revoked token 检查（带 30s 内存缓存），仅在本地 JWT 验证成功时执行。
  // 缓存命中 true 表示已撤销；缓存命中 false 表示未撤销（跳过 DB 查询）；
  // 缓存未命中则查询 DB 并写缓存。
  const localPayload = jwtService.verifySupabaseToken(token);
  if (localPayload) {
    const tokenHash = jwtService.computeTokenHash(token);
    const revokedCacheKey = `auth:revoked:${tokenHash}`;
    const revokedCached = await cacheService.get<boolean>(revokedCacheKey);

    if (revokedCached === true) {
      throw new AppError('Token has been revoked', 401, ErrorCodes.AUTH_TOKEN_REVOKED);
    }

    if (revokedCached === undefined) {
      const isRevoked = await jwtService.isTokenRevoked(token);
      await cacheService.set(revokedCacheKey, isRevoked, 30);
      if (isRevoked) {
        throw new AppError('Token has been revoked', 401, ErrorCodes.AUTH_TOKEN_REVOKED);
      }
    }
  }

  const result = await verifyAndCacheUser(token);
  if (!result) {
    throw new AppError('User not found', 401, ErrorCodes.AUTH_TOKEN_INVALID);
  }

  req.user = result.user;
  req.supabase = result.supabaseClient;
  // 不 await next()：与原始 fallback 路径行为一致，requireAdmin 的 async
  // 回调抛错时成为 unhandled rejection（而非传播到 requireAdmin），保持
  // 现有测试期望的错误处理语义。
  next();
  return;
};

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    req.supabase = getSupabaseAnon();
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    req.supabase = getSupabaseAnon();
    return next();
  }

  const token = parts[1];

  if (!token) {
    req.supabase = getSupabaseAnon();
    return next();
  }

  try {
    const result = await verifyAndCacheUser(token);
    if (result) {
      req.user = result.user;
      req.supabase = result.supabaseClient;
    } else {
      req.supabase = getSupabaseAnon();
    }
  } catch {
    req.supabase = getSupabaseAnon();
  }

  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    if (!req.user?.id) {
      throw new AppError('User not authenticated', 401, ErrorCodes.AUTH_UNAUTHORIZED);
    }

    const cacheKey = `user_role:${req.user.id}`;
    const cachedRole = await cacheService.get<string>(cacheKey);

    let role: string | undefined = cachedRole;

    if (cachedRole === undefined) {
      const { data: userRecord, error } = await getSupabaseAdmin()
        .from('users')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error || !userRecord) {
        throw new AppError('Failed to verify user role', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      role = userRecord.role;
      cacheService.set(cacheKey, role, 300).catch(() => {});
    }

    if (role === 'admin') {
      return next();
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (req.user.email && adminEmails.includes(req.user.email)) {
      return next();
    }

    throw new AppError('Admin access required', 403, ErrorCodes.AUTH_FORBIDDEN);
  });
};
