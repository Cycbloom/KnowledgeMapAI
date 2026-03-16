import { app } from 'electron';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerStatus {
  isRunning: boolean;
  port?: number;
  error?: string;
}

export class ServerService {
  private server: http.Server | null = null;
  private isRunning = false;
  private currentPort: number = 0;
  private readonly defaultPort: number = 3001;
  private readonly maxPortAttempts: number = 10;

  async start(preferredPort?: number): Promise<ServerStatus> {
    if (this.isRunning) {
      return {
        isRunning: true,
        port: this.currentPort,
      };
    }

    const startPort = preferredPort || this.defaultPort;
    
    try {
      const port = await this.findAvailablePort(startPort);
      await this.startServer(port);
      
      this.isRunning = true;
      this.currentPort = port;
      
      console.log(`[ServerService] Server started on port ${port}`);
      
      return {
        isRunning: true,
        port: this.currentPort,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ServerService] Failed to start server:', errorMessage);
      
      return {
        isRunning: false,
        error: errorMessage,
      };
    }
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + this.maxPortAttempts; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
      console.log(`[ServerService] Port ${port} is in use, trying next...`);
    }
    throw new Error(`No available port found after ${this.maxPortAttempts} attempts starting from ${startPort}`);
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net
        .createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.once('close', () => resolve(true)).close();
        })
        .listen(port);
    });
  }

  private async startServer(port: number): Promise<void> {
    const app = await this.loadExpressApp();
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer(app);
      
      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use`));
        } else {
          reject(error);
        }
      });

      this.server.listen(port, () => {
        console.log(`[ServerService] HTTP server listening on port ${port}`);
        resolve();
      });

      this.setupGracefulShutdown();
    });
  }

  private async loadExpressApp(): Promise<http.RequestListener> {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
      console.log('[ServerService] Loading Express app in development mode');
      const { default: app } = await import('../../api/app.js');
      return app;
    } else {
      console.log('[ServerService] Loading Express app in production mode');
      
      const apiPath = path.join(process.resourcesPath, 'api', 'app.js');
      console.log('[ServerService] Loading from:', apiPath);
      
      try {
        const { default: app } = await import(apiPath);
        return app;
      } catch (error) {
        console.error('[ServerService] Failed to load app from resources:', error);
        
        const fallbackPath = path.join(__dirname, '../../api/app.js');
        console.log('[ServerService] Trying fallback path:', fallbackPath);
        const { default: app } = await import(fallbackPath);
        return app;
      }
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('[ServerService] Graceful shutdown initiated');
      await this.stop();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        console.log('[ServerService] HTTP server closed');
        this.server = null;
        this.isRunning = false;
        this.currentPort = 0;
        resolve();
      });

      setTimeout(() => {
        console.log('[ServerService] Force closing server after timeout');
        this.server = null;
        this.isRunning = false;
        this.currentPort = 0;
        resolve();
      }, 5000);
    });
  }

  getStatus(): ServerStatus {
    return {
      isRunning: this.isRunning,
      port: this.isRunning ? this.currentPort : undefined,
    };
  }

  getPort(): number | undefined {
    return this.isRunning ? this.currentPort : undefined;
  }
}

export const serverService = new ServerService();
