import { Response } from 'express';
import { logger } from '../utils/logger.js';

class SSEService {
  private clients: Map<string, Response[]> = new Map();

  addClient(userId: string, res: Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)?.push(res);

    logger.info(`[SSE] Client connected: ${userId}. Total clients for user: ${this.clients.get(userId)?.length}`);

    res.on('close', () => {
      this.removeClient(userId, res);
    });
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
      logger.info(`[SSE] Client disconnected: ${userId}. Remaining clients: ${newClients.length}`);
    }
  }

  sendToUser(userId: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.length > 0) {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach(client => {
        try {
          client.write(message);
        } catch (error) {
          logger.error(`[SSE] Error sending to client for user ${userId}:`, error);
        }
      });
      logger.info(`[SSE] Broadcasted to user ${userId}: ${JSON.stringify(data).substring(0, 100)}...`);
    }
  }

  startHeartbeat(intervalMs: number = 30000) {
    setInterval(() => {
      this.clients.forEach((clients, userId) => {
        if (clients.length > 0) {
          clients.forEach(client => {
            try {
              client.write(': keep-alive\n\n');
            } catch (error) {
              logger.error(`[SSE] Error sending heartbeat to user ${userId}:`, error);
            }
          });
        }
      });
    }, intervalMs);
  }
}

export const sseService = new SSEService();
sseService.startHeartbeat();
