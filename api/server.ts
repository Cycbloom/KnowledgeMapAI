import './supabase';
import app, { kernel } from './app';
import { logger } from './utils/logger';
import { checkEnvOnStartup } from './utils/envValidator';
import { performanceMonitor } from './services/ai/performanceMonitor';
import { corePlugin } from './services/plugins/CorePlugin';
import { graphPlugin } from './services/plugins/GraphPlugin';
import { AIPlugin as aiPlugin } from './services/plugins/AIPlugin';
import { StudyPlugin as studyPlugin } from './services/plugins/StudyPlugin';
import { SchedulerPlugin as schedulerPlugin } from './services/plugins/SchedulerPlugin';
import { AgentPlugin as agentPlugin } from './services/plugins/AgentPlugin';
import { PluginLoader } from './services/kernel/PluginLoader';
import { PluginStoreService } from './services/kernel/PluginStoreService';

checkEnvOnStartup();

performanceMonitor.initialize().then(() => {
  logger.info('[PerformanceMonitor] Initialized successfully');
}).catch((error) => {
  logger.error('[PerformanceMonitor] Initialization failed:', error);
});

kernel.registerPlugin(corePlugin);
kernel.registerPlugin(graphPlugin);
kernel.registerPlugin(aiPlugin);
kernel.registerPlugin(studyPlugin);
kernel.registerPlugin(schedulerPlugin);
kernel.registerPlugin(agentPlugin);

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, async () => {
  logger.info(`Server ready on port ${PORT}`);

  try {
    await kernel.activateAll();
    logger.info('[Kernel] All built-in plugins activated successfully');
  } catch (error) {
    logger.error('[Kernel] Failed to activate plugins:', error);
  }

  try {
    const pluginStoreService = new PluginStoreService(kernel);
    const pluginLoader = new PluginLoader(kernel, pluginStoreService.getPluginsDir());
    const result = await pluginLoader.loadInstalledPlugins();
    logger.info(`[PluginLoader] Third-party plugins: ${result.loaded} loaded, ${result.failed} failed`);
  } catch (error) {
    logger.error('[PluginLoader] Failed to load third-party plugins:', error);
  }
});

process.on('unhandledRejection', (err: Error) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: Error) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  try {
    await kernel.deactivateAll();
    logger.info('[Kernel] All plugins deactivated');
  } catch (error) {
    logger.error('[Kernel] Error during plugin deactivation:', error);
  }

  server.close(() => {
    logger.info('HTTP Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
