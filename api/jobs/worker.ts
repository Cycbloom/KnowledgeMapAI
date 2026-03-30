import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { taskProcessor } from './taskProcessor';
import { supabaseAdmin } from '../supabase';
import { logger } from '../utils/logger';
import { isRedisAvailable } from '../utils/redis';

let taskWorker: Worker | null = null;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  logger.info('🔌 Initializing Task Worker...');
  
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  connection.on('error', (err) => {
    if (isRedisAvailable) {
      logger.warn('Worker Redis connection error:', err.message);
    }
  });

  connection.on('connect', () => {
    logger.info('✅ Worker Redis connected');
  });

  connection.on('ready', () => {
    if (!taskWorker) {
      taskWorker = new Worker('task-queue', async (job) => {
        const { taskId } = job.data;
        logger.debug(`Processing job ${job.id} for task ${taskId}`);

        try {
          const { data: task, error } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

          if (error || !task) {
            logger.error(`[Worker] Task ${taskId} not found in DB:`, error);
            return;
          }

          await taskProcessor.processTask(task);

        } catch (err) {
          logger.error(`[Worker] Critical error processing task ${taskId}:`, err);
          throw err;
        }
      }, { 
        connection,
        concurrency: 5
      });

      taskWorker.on('completed', job => {
        logger.debug(`Job ${job.id} completed successfully`);
      });

      taskWorker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed: ${err.message}`);
      });

      logger.info('✅ Task Worker initialized with Redis');
    }
  });

  connection.on('close', () => {
    if (taskWorker) {
      logger.warn('⚠️ Worker Redis connection closed, background task processing disabled');
      taskWorker = null;
    }
  });

  connection.connect().catch((err) => {
    logger.warn('⚠️ Failed to connect to Redis for worker:', err.message);
    logger.info('📦 Background task processing will be disabled');
  });
} else {
  logger.warn('⚠️ No REDIS_URL found, background task processing will be disabled');
}

export { taskWorker };
