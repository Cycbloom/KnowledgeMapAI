/**
 * local server entry file, for local development
 */
import app from './app.js';
import { taskProcessor } from './jobs/taskProcessor.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  
  // Start Background Task Processor
  console.log('[Worker] Starting Task Processor...');
  setInterval(() => {
    taskProcessor.processPendingTasks();
  }, 5000); // Poll every 5 seconds
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;