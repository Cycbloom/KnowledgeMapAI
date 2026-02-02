import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Reuse REDIS_URL from environment
const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const taskQueue = new Queue('task-queue', { connection });
