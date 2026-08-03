import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import type { UserWithoutPassword } from '../../models/user';
import { getSupabaseAdmin } from '../../supabase';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
  jti?: string;
  type?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const ACCESS_TOKEN_EXPIRES_SECONDS = 3600;

function getJwtSecret(): string {
  // 生产环境必须显式配置 JWT_SECRET，避免多实例密钥不一致
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production');
  }

  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const secretPath = path.join(process.cwd(), '.jwt_secret');
  
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    }
  } catch (error) {
    logger.warn('Failed to read JWT secret file', { error });
  }

  const newSecret = crypto.randomBytes(64).toString('hex');
  
  try {
    fs.writeFileSync(secretPath, newSecret, { mode: 0o600 });
    logger.info('Generated new JWT secret and saved to .jwt_secret');
  } catch (error) {
    logger.warn('Failed to save JWT secret file, using in-memory secret', { error });
  }

  return newSecret;
}

let jwtSecret: string | null = null;

function getSecret(): string {
  if (!jwtSecret) {
    jwtSecret = getJwtSecret();
  }
  return jwtSecret;
}

export class JwtService {
  generateToken(user: UserWithoutPassword): TokenPair {
    const secret = getSecret();
    
    const payload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, secret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
    };
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      const secret = getSecret();
      const decoded = jwt.verify(token, secret) as JwtPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Token expired', { expiredAt: error.expiredAt });
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid token', { message: error.message });
      }
      return null;
    }
  }

  verifyRefreshToken(token: string): JwtPayload | null {
    try {
      const secret = getSecret();
      const decoded = jwt.verify(token, secret) as JwtPayload;
      return decoded;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 验证 Supabase Auth 下发的 JWT（区别于 app 自有 JWT）
   * 使用 SUPABASE_JWT_SECRET 环境变量验证签名
   * @returns { sub: string } | null
   */
  verifySupabaseToken(token: string): { sub: string } | null {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      // 开发环境未配置时回退到远程验证
      return null;
    }
    try {
      const payload = jwt.verify(token, secret) as { sub?: string };
      if (!payload.sub) return null;
      return { sub: payload.sub };
    } catch {
      return null;
    }
  }

  /**
   * Compute the SHA-256 hash of a token (hex encoded).
   * Used for storing/looking up tokens in the revoked_tokens blacklist.
   */
  computeTokenHash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Check if a token has been revoked by querying the revoked_tokens table.
   * Note: This method does NOT use cache. Callers should wrap with caching
   * logic (see requireAuth middleware) to reduce DB load.
   *
   * @param token The raw token string to check.
   * @returns true if the token is revoked, false otherwise. Fails open on DB error.
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    const tokenHash = this.computeTokenHash(token);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('revoked_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      logger.warn('Failed to query revoked_tokens table, failing open', { error });
      return false;
    }

    return data !== null;
  }

  /**
   * Refresh the access token by rotating the refresh token.
   *
   * Flow:
   *   1. Verify the old refresh token R1
   *   2. Check if R1 is already revoked (blacklisted)
   *   3. Generate new access token A2 and refresh token R2 (with new jti)
   *   4. Insert R1's sha256 hash into revoked_tokens table
   *   5. Return { accessToken: A2, refreshToken: R2, expiresIn }
   *
   * @throws AppError with AUTH_TOKEN_INVALID if R1 is invalid
   * @throws AppError with AUTH_TOKEN_REVOKED if R1 is already revoked
   * @throws AppError with SYSTEM_INTERNAL_ERROR on DB failure
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    // Step 1: Verify the old refresh token R1
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError('Invalid refresh token', 401, ErrorCodes.AUTH_TOKEN_INVALID);
    }

    // Step 2: Compute R1's sha256 hash and check if it's already revoked
    const tokenHash = this.computeTokenHash(refreshToken);
    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('revoked_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (existing) {
      throw new AppError('Refresh token has been revoked', 401, ErrorCodes.AUTH_TOKEN_REVOKED);
    }

    // Step 3: Generate new access token A2 and refresh token R2 (with new jti)
    const newPayload = {
      userId: payload.userId,
      email: payload.email,
    };

    const accessToken = jwt.sign(newPayload, getSecret(), {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const newRefreshToken = jwt.sign(
      { ...newPayload, type: 'refresh', jti: crypto.randomUUID() },
      getSecret(),
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Step 4: Insert R1's hash into revoked_tokens (expires_at synced with R1's exp)
    const { error: insertError } = await admin.from('revoked_tokens').insert({
      token_hash: tokenHash,
      user_id: payload.userId,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });

    if (insertError) {
      // Duplicate key (23505): token already revoked, likely a race condition
      if (insertError.code === '23505') {
        throw new AppError('Refresh token has been revoked', 401, ErrorCodes.AUTH_TOKEN_REVOKED);
      }
      logger.error('Failed to insert revoked token', { error: insertError });
      throw new AppError('Failed to revoke refresh token', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    // Step 5: Return new token pair
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
    };
  }
}

export const jwtService = new JwtService();
