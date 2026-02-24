import { logger } from './logger.js';

export const validateEnv = () => {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    logger.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    logger.warn('⚠️  Some features may not work correctly.');
  }

  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  REDIS_URL is missing in production. Background tasks and caching will be disabled.');
    } else {
      logger.warn('⚠️  REDIS_URL is missing. Background tasks and caching will fallback or fail.');
    }
  }

  if (process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.startsWith('http')) {
    throw new Error('VITE_SUPABASE_URL must be a valid URL starting with http:// or https://');
  }
};
