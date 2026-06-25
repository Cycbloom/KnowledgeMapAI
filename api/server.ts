import app, { kernel } from './app';
import { logger } from './utils/logger';
import { checkEnvOnStartup } from './utils/envValidator';
import { performanceMonitor } from './services/ai/performanceMonitor';
import { PluginLoader } from './services/kernel/PluginLoader';
import { PluginStoreService } from './services/kernel/PluginStoreService';
import type { Server } from 'http';
import { setupRealtimeSTT } from './routes/ai/stt-realtime';

const PORT = process.env.PORT || 3001;

interface HealthStatus {
  service: string;
  phase: string;
  status: 'success' | 'failed' | 'skipped';
  details?: string;
}

const healthReport: HealthStatus[] = [];

function addHealth(status: HealthStatus): void {
  healthReport.push(status);
}

function buildHealthSummary(elapsedMs: number): string {
  const lines: string[] = [];
  const phases = ['1', '2', '3', '4', '5'];

  for (const phase of phases) {
    const items = healthReport.filter((h) => h.phase === phase);
    for (const item of items) {
      const icon = item.status === 'success' ? '✅' : item.status === 'failed' ? '❌' : '⏭️';
      const detail = item.details ? ` (${item.details})` : '';
      lines.push(`${icon} ${item.service}${detail}`);
    }
  }

  lines.push(`⏱️ Total startup time: ${elapsedMs}ms`);
  return lines.join('\n');
}

let server: Server;

async function bootstrap(): Promise<void> {
  const startTime = Date.now();

  logger.separator('=');
  logger.box('Server Startup', 'Initializing KnowledgeMap Server...');

  // ===== Phase 1: Environment Check (blocking) =====
  logger.info('[Phase 1/5] Environment check...');
  try {
    checkEnvOnStartup();
    addHealth({ service: 'Environment Validator', phase: '1', status: 'success' });
    logger.info('[Phase 1/5] Environment check completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addHealth({ service: 'Environment Validator', phase: '1', status: 'failed', details: message });
    logger.error('[Phase 1/5] Environment check failed, shutting down:', error);
    process.exit(1);
  }

  // ===== Phase 2: Plugin Registration (done in app.ts at module load time) =====
  logger.info('[Phase 2/5] Plugin registration (already done in app.ts)');
  addHealth({ service: 'Kernel Plugin Registration', phase: '2', status: 'success' });

  // ===== Phase 3: Server Listen (blocking) =====
  logger.info('[Phase 3/5] Starting HTTP server...');
  server = await new Promise<Server>((resolve, reject) => {
    const srv = app.listen(PORT, () => {
      logger.info(`Server ready on port ${PORT}`);
      resolve(srv);
    });
    srv.on('error', (err) => {
      reject(err);
    });
  });

  addHealth({ service: 'HTTP Server', phase: '3', status: 'success', details: `Port ${PORT}` });
  logger.info('[Phase 3/5] HTTP server started');

  // Setup WebSocket for realtime STT
  setupRealtimeSTT(server);
  logger.info('[Phase 3/5] Realtime STT WebSocket server attached');

  // ===== Phase 4: Plugin Activation (blocking) =====
  logger.info('[Phase 4/5] Plugin activation...');
  try {
    await kernel.activateAll();
    addHealth({ service: 'Built-in Plugin Activation', phase: '4', status: 'success' });
    logger.info('[Phase 4/5] All built-in plugins activated');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addHealth({ service: 'Built-in Plugin Activation', phase: '4', status: 'failed', details: message });
    logger.error('[Phase 4/5] Plugin activation failed, shutting down:', error);
    server.close(() => process.exit(1));
    return;
  }

  // ===== Phase 5: Non-critical Services (non-blocking) =====
  logger.info('[Phase 5/5] Non-critical services initialization...');

  performanceMonitor.initialize().then(() => {
    addHealth({ service: 'Performance Monitor', phase: '5', status: 'success' });
    logger.info('[Phase 5/5] Performance Monitor initialized');
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    addHealth({ service: 'Performance Monitor', phase: '5', status: 'failed', details: message });
    logger.warn('[Phase 5/5] Performance Monitor initialization failed (non-critical):', error);
  });

  const pluginStoreService = new PluginStoreService(kernel);
  const pluginLoader = new PluginLoader(kernel, pluginStoreService.getPluginsDir());

  pluginLoader.loadInstalledPlugins().then((result) => {
    addHealth({
      service: 'Third-party Plugins',
      phase: '5',
      status: 'success',
      details: `${result.loaded} loaded, ${result.failed} failed`,
    });
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    addHealth({ service: 'Third-party Plugins', phase: '5', status: 'failed', details: message });
    logger.warn('[Phase 5/5] Third-party plugin loading failed (non-critical):', error);
  });

  // ===== Graceful Shutdown Handlers =====
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

  // ===== Health Check Summary =====
  const elapsed = Date.now() - startTime;
  setTimeout(() => {
    logger.separator('=');
    logger.box('Startup Health Check', buildHealthSummary(elapsed));
  }, 500);
}

bootstrap().catch((error) => {
  logger.error('Fatal startup error:', error);
  process.exit(1);
});

export default app;