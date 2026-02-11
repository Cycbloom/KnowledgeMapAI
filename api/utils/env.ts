import { logger } from './logger.js';

export const validateEnv = () => {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    // 'REDIS_URL' // Optional for local dev if we make worker/queue conditional, but currently strict
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    logger.warn('⚠️  Some features may not work correctly.');
  }

  if (!process.env.REDIS_URL) {
    logger.warn('⚠️  REDIS_URL is missing. Background tasks and caching will fallback or fail.');
  }
};
