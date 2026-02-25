import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { taskProcessor } from './taskProcessor.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';

// Reuse REDIS_URL from environment
const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const taskWorker = new Worker('task-queue', async (job) => {
  const { taskId } = job.data;
  logger.debug(`Processing job ${job.id} for task ${taskId}`);

  try {
    // Fetch the task record from database
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      console.error(`[Worker] Task ${taskId} not found in DB:`, error);
      return;
    }

    // Delegate execution to the existing TaskProcessor logic
    await taskProcessor.processTask(task);

  } catch (err) {
    console.error(`[Worker] Critical error processing task ${taskId}:`, err);
    throw err;
  }
}, { 
  connection,
  concurrency: 5 // Process up to 5 tasks concurrently
});

taskWorker.on('completed', job => {
  logger.debug(`Job ${job.id} completed successfully`);
});

taskWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});
