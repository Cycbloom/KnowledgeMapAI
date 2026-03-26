import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

let redisClient: Redis | undefined;
export let isRedisAvailable = false;

if (redisUrl) {
  logger.info('🔌 Initializing Redis Client...');
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  redisClient.on('error', (err) => {
    if (isRedisAvailable) {
      logger.error('Redis Client Error:', err.message);
      logger.warn('⚠️ Redis connection lost, falling back to in-memory cache');
    }
    isRedisAvailable = false;
  });

  redisClient.on('connect', () => {
    logger.info('✅ Redis Client Connected');
  });

  redisClient.on('ready', () => {
    isRedisAvailable = true;
    logger.info('✅ Redis is ready and available');
  });

  redisClient.on('close', () => {
    if (isRedisAvailable) {
      logger.warn('⚠️ Redis connection closed');
    }
    isRedisAvailable = false;
  });
} else {
  logger.warn('⚠️ No REDIS_URL found, Redis features will be disabled.');
}

export default redisClient;
