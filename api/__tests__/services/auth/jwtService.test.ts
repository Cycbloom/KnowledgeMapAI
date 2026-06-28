import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import type { UserWithoutPassword } from '../../../models/user';
import { AppError } from '../../../middleware/errorHandler';
import { ErrorCodes } from '../../../../shared/types/errorCodes';

// Mock supabase module - mock functions must be hoisted before the mock factory runs.
// The chain is: admin.from('revoked_tokens').select('id').eq('token_hash', h).maybeSingle()
// and: admin.from('revoked_tokens').insert({...})
const {
  mockMaybeSingle,
  mockInsert,
  mockEq,
  mockSelect,
  mockFrom,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockInsert = vi.fn();
  // Each link in the chain returns the next link's container.
  const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }));
  return { mockMaybeSingle, mockInsert, mockEq, mockSelect, mockFrom };
});

vi.mock('../../../supabase', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

// Import jwtService AFTER supabase mock is in place
import { jwtService } from '../../../services/auth/jwtService';

const TEST_SECRET = 'test-jwt-secret-for-vitest-12345';

const mockUser: UserWithoutPassword = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

/**
 * Generate an expired refresh token (exp set to 1 hour ago).
 * jwt.sign with `exp` in payload produces an immediately-expired token.
 */
const generateExpiredRefreshToken = (user: UserWithoutPassword): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'refresh',
      exp: Math.floor(Date.now() / 1000) - 3600,
    },
    TEST_SECRET,
  );
};

describe('JwtService', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: DB select returns null (not revoked), DB insert succeeds
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken and verifyToken', () => {
    it('should generate a token pair and verify the access token', () => {
      const tokenPair = jwtService.generateToken(mockUser);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');
      expect(tokenPair.expiresIn).toBe(3600);

      const payload = jwtService.verifyToken(tokenPair.accessToken);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should return null for an invalid token', () => {
      const payload = jwtService.verifyToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for an expired access token', () => {
      const expiredToken = jwt.sign(
        {
          userId: mockUser.id,
          email: mockUser.email,
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
        TEST_SECRET,
      );
      const payload = jwtService.verifyToken(expiredToken);
      expect(payload).toBeNull();
    });

    it('should verify refresh token', () => {
      const tokenPair = jwtService.generateToken(mockUser);
      const payload = jwtService.verifyRefreshToken(tokenPair.refreshToken);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should return null for an invalid refresh token', () => {
      const payload = jwtService.verifyRefreshToken('invalid-refresh-token');
      expect(payload).toBeNull();
    });
  });

  describe('computeTokenHash', () => {
    it('should compute a 64-char hex string (sha256)', () => {
      const hash = jwtService.computeTokenHash('test-token');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce the same hash for the same token', () => {
      const hash1 = jwtService.computeTokenHash('test-token');
      const hash2 = jwtService.computeTokenHash('test-token');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = jwtService.computeTokenHash('token-1');
      const hash2 = jwtService.computeTokenHash('token-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false when token is not in blacklist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const isRevoked = await jwtService.isTokenRevoked('some-token');
      expect(isRevoked).toBe(false);
      expect(mockFrom).toHaveBeenCalledWith('revoked_tokens');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith(
        'token_hash',
        jwtService.computeTokenHash('some-token'),
      );
    });

    it('should return true when token is in blacklist', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: 'rev-id' }, error: null });
      const isRevoked = await jwtService.isTokenRevoked('revoked-token');
      expect(isRevoked).toBe(true);
    });

    it('should fail open (return false) on DB error', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'DB connection error' },
      });
      const isRevoked = await jwtService.isTokenRevoked('some-token');
      expect(isRevoked).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new accessToken and refreshToken on valid refresh', async () => {
      const tokenPair = jwtService.generateToken(mockUser);
      const result = await jwtService.refreshAccessToken(tokenPair.refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.expiresIn).toBe(3600);

      // New refreshToken should be different from the old one (rotation)
      expect(result.refreshToken).not.toBe(tokenPair.refreshToken);

      // Should verify the old token's payload (DB select)
      expect(mockFrom).toHaveBeenCalledWith('revoked_tokens');
      expect(mockSelect).toHaveBeenCalledWith('id');

      // Should insert the old token's hash into revoked_tokens
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith({
        token_hash: jwtService.computeTokenHash(tokenPair.refreshToken),
        user_id: mockUser.id,
        expires_at: expect.any(String),
      });
    });

    it('should throw AUTH_TOKEN_REVOKED when refresh token is already revoked', async () => {
      const tokenPair = jwtService.generateToken(mockUser);
      mockMaybeSingle.mockResolvedValue({ data: { id: 'rev-id' }, error: null });

      await expect(
        jwtService.refreshAccessToken(tokenPair.refreshToken),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_REVOKED,
      });

      // Should NOT insert into revoked_tokens (already revoked)
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw AUTH_TOKEN_INVALID when refresh token is invalid', async () => {
      await expect(jwtService.refreshAccessToken('invalid-token')).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_INVALID,
      });

      // Should NOT query DB (token verification failed first)
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw 401 when refresh token is expired', async () => {
      const expiredRefreshToken = generateExpiredRefreshToken(mockUser);

      await expect(jwtService.refreshAccessToken(expiredRefreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });

      // Should NOT query DB (token verification failed first)
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw AUTH_TOKEN_REVOKED on duplicate key (race condition)', async () => {
      const tokenPair = jwtService.generateToken(mockUser);
      mockInsert.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key violation' },
      });

      await expect(
        jwtService.refreshAccessToken(tokenPair.refreshToken),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_REVOKED,
      });
    });

    it('should throw SYSTEM_INTERNAL_ERROR on DB insert failure', async () => {
      const tokenPair = jwtService.generateToken(mockUser);
      mockInsert.mockResolvedValue({
        data: null,
        error: { code: 'XYZ', message: 'DB error' },
      });

      await expect(
        jwtService.refreshAccessToken(tokenPair.refreshToken),
      ).rejects.toMatchObject({
        statusCode: 500,
        code: ErrorCodes.SYSTEM_INTERNAL_ERROR,
      });
    });

    it('should reject old refresh token after rotation (reuse scenario)', async () => {
      const tokenPair = jwtService.generateToken(mockUser);

      // First refresh: succeeds, R1 is now blacklisted
      const result1 = await jwtService.refreshAccessToken(tokenPair.refreshToken);
      expect(result1.refreshToken).not.toBe(tokenPair.refreshToken);

      // Second refresh with old token: DB now returns a row (revoked)
      mockMaybeSingle.mockResolvedValue({ data: { id: 'rev-id' }, error: null });
      await expect(
        jwtService.refreshAccessToken(tokenPair.refreshToken),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: ErrorCodes.AUTH_TOKEN_REVOKED,
      });
    });

    it('should issue a new refresh token with a jti claim', async () => {
      const tokenPair = jwtService.generateToken(mockUser);
      const result = await jwtService.refreshAccessToken(tokenPair.refreshToken);

      const decoded = jwt.verify(result.refreshToken, TEST_SECRET) as {
        jti?: string;
        type?: string;
        userId?: string;
      };
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
      expect(decoded.type).toBe('refresh');
      expect(decoded.userId).toBe(mockUser.id);
    });

    it('should produce AppError instances on failure', async () => {
      try {
        await jwtService.refreshAccessToken('invalid-token');
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
      }
    });
  });
});
