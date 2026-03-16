import bcrypt from 'bcrypt';
import { logger } from '../../utils/logger.js';

const SALT_ROUNDS = 12;

export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      return hash;
    } catch (error) {
      logger.error('Failed to hash password', { error });
      throw new Error('Failed to hash password');
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      logger.error('Failed to verify password', { error });
      return false;
    }
  }
}

export const passwordService = new PasswordService();
