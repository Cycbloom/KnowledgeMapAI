import Redis from 'ioredis';
import { logger } from './logger';

logger.warn('⚠️ Redis features are disabled, using in-memory cache only.');

let redisClient: Redis | undefined;
export let isRedisAvailable = false;

export default redisClient;
