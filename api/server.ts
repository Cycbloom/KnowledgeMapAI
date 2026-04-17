/**
 * local server entry file, for local development
 */
import './supabase'; // Load environment variables first
import app from './app';
import './jobs/worker.js'; // Initialize BullMQ Worker (optional, requires Redis)
import { taskWorker } from './jobs/worker';
import { logger } from './utils/logger';
import { checkEnvOnStartup } from './utils/envValidator';
import { performanceMonitor } from './services/ai/performanceMonitor';
import { schedulerCronService } from './services/scheduler/core/cronService';
import { schedulerSubscribers } from './services/scheduler/core/subscribers';
import { supabaseAdmin } from './supabase';
import { appEventBus } from './services/core/eventBus';
import {
  cacheInvalidationSubscriber,
  sseNotificationSubscriber,
  achievementSubscriber,
  learningProgressSubscriber,
  reviewSchedulerSubscriber,
} from './services/core/subscribers';

/**
 * Validate Environment
 */
checkEnvOnStartup();

/**
 * Initialize Performance Monitor (load historical logs)
 */
performanceMonitor.initialize().then(() => {
  logger.info('[PerformanceMonitor] Initialized successfully');
}).catch((error) => {
  logger.error('[PerformanceMonitor] Initialization failed:', error);
});

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`Server ready on port ${PORT}`);
  if (taskWorker) {
    logger.info('[Worker] BullMQ Worker started');
  } else {
    logger.info('[Worker] BullMQ Worker not started (Redis not available)');
  }

  schedulerSubscribers.initialize(supabaseAdmin);

  cacheInvalidationSubscriber.initialize();
  sseNotificationSubscriber.initialize();
  achievementSubscriber.initialize();
  learningProgressSubscriber.initialize();
  reviewSchedulerSubscriber.initialize();

  schedulerCronService.start();

  logger.info(`[AppEventBus] Initialized with ${appEventBus.getHandlerCount()} total handlers`);
  logger.info('[Scheduler] Cron service and all event subscribers initialized');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

/**
 * close server
 */
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  schedulerCronService.stop();

  cacheInvalidationSubscriber.destroy();
  sseNotificationSubscriber.destroy();
  achievementSubscriber.destroy();
  learningProgressSubscriber.destroy();
  reviewSchedulerSubscriber.destroy();

  appEventBus.clear();

  // Close the worker if it exists
  if (taskWorker) {
    await taskWorker.close();
    logger.info('Worker closed');
  }

  server.close(() => {
    logger.info('HTTP Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
