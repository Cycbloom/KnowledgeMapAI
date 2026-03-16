import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger.js';
import type { UserWithoutPassword } from '../../models/user.js';

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
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
    } catch (error) {
      return null;
    }
  }

  refreshAccessToken(refreshToken: string): TokenPair | null {
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) {
      return null;
    }

    return {
      accessToken: jwt.sign(
        { userId: payload.userId, email: payload.email },
        getSecret(),
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      ),
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
    };
  }
}

export const jwtService = new JwtService();
