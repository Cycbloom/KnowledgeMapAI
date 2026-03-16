import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger.js';
dotenv.config();
const redisUrl = process.env.REDIS_URL;
let redisClient;
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
        logger.error('Redis Client Error:', err);
    });
    redisClient.on('connect', () => {
        logger.info('✅ Redis Client Connected');
    });
}
else {
    logger.warn('⚠️ No REDIS_URL found, Redis features will be disabled.');
}
export default redisClient;
//# sourceMappingURL=redis.js.map