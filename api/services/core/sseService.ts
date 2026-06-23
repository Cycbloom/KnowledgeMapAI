import { Response } from 'express';
import { logger } from '../../utils/logger';

class SSEService {
  private clients: Map<string, Response[]> = new Map();
  private maxConnectionsPerUser: number = 5;
  private maxWriteFailures: number = 3;
  private writeFailures: Map<Response, number> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  addClient(userId: string, res: Response): boolean {
    const currentClients = this.clients.get(userId);
    if (currentClients && currentClients.length >= this.maxConnectionsPerUser) {
      logger.warn(`[SSE] Connection limit reached for user ${userId}: ${currentClients.length}/${this.maxConnectionsPerUser}`);
      return false;
    }
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)?.push(res);

    logger.info(`[SSE] Client connected: ${userId}. Total clients for user: ${this.clients.get(userId)?.length}`);

    res.on('close', () => {
      this.removeClient(userId, res);
    });
    return true;
  }

  removeClient(userId: string, res: Response) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const newClients = userClients.filter(client => client !== res);
      if (newClients.length > 0) {
        this.clients.set(userId, newClients);
      } else {
        this.clients.delete(userId);
      }
      this.writeFailures.delete(res);
      logger.info(`[SSE] Client disconnected: ${userId}. Remaining clients: ${newClients.length}`);
    }
  }

  sendToUser(userId: string, data: unknown) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.length > 0) {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach(client => {
        let writeResult: boolean;
        try {
          writeResult = client.write(message);
        } catch (error) {
          logger.error(`[SSE] Error sending to client for user ${userId}:`, error);
          writeResult = false;
        }
        this.handleWriteResult(userId, client, writeResult);
      });
      logger.info(`[SSE] Broadcasted to user ${userId}: ${JSON.stringify(data).substring(0, 100)}...`);
    }
  }

  private handleWriteResult(userId: string, client: Response, writeResult: boolean): void {
    if (writeResult) {
      this.writeFailures.delete(client);
      return;
    }
    const failures = (this.writeFailures.get(client) ?? 0) + 1;
    this.writeFailures.set(client, failures);
    if (failures >= this.maxWriteFailures) {
      logger.warn(`[SSE] Removing dead connection for user ${userId} after ${failures} consecutive write failures`);
      this.removeClient(userId, client);
      try {
        client.end();
      } catch (error) {
        logger.error(`[SSE] Error ending dead connection for user ${userId}:`, error);
      }
    }
  }

  startHeartbeat(intervalMs: number = 25000) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((clients, userId) => {
        if (clients.length > 0) {
          clients.forEach(client => {
            let writeResult: boolean;
            try {
              writeResult = client.write(': keep-alive\n\n');
            } catch (error) {
              logger.error(`[SSE] Error sending heartbeat to user ${userId}:`, error);
              writeResult = false;
            }
            this.handleWriteResult(userId, client, writeResult);
          });
        }
      });
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const sseService = new SSEService();
sseService.startHeartbeat();
