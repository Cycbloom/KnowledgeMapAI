/**
 * local server entry file, for local development
 */
import app from './app.js';
import './jobs/worker.js'; // Initialize BullMQ Worker
import { taskWorker } from './jobs/worker.js';
import { logger } from './utils/logger.js';
import { checkEnvOnStartup } from './utils/envValidator.js';

/**
 * Validate Environment
 */
checkEnvOnStartup();

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`Server ready on port ${PORT}`);
  logger.info('[Worker] BullMQ Worker started');
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
  
  // Close the worker
  await taskWorker.close();
  logger.info('Worker closed');

  server.close(() => {
    logger.info('HTTP Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;