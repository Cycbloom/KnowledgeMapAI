import { Queue } from 'bullmq';
import Redis from 'ioredis';
const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
export const taskQueue = new Queue('task-queue', { connection });
//# sourceMappingURL=queueService.js.map