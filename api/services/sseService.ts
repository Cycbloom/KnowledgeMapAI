import { Response } from 'express';

class SSEService {
  private clients: Map<string, Response[]> = new Map();

  // 添加客户端连接
  addClient(userId: string, res: Response) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)?.push(res);

    console.log(`[SSE] Client connected: ${userId}. Total clients for user: ${this.clients.get(userId)?.length}`);

    // 监听连接关闭
    res.on('close', () => {
      this.removeClient(userId, res);
    });
  }

  // 移除客户端
  removeClient(userId: string, res: Response) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const newClients = userClients.filter(client => client !== res);
      if (newClients.length > 0) {
        this.clients.set(userId, newClients);
      } else {
        this.clients.delete(userId);
      }
      console.log(`[SSE] Client disconnected: ${userId}. Remaining clients: ${newClients.length}`);
    }
  }

  // 发送消息给指定用户
  sendToUser(userId: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.length > 0) {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach(client => {
        try {
          client.write(message);
        } catch (error) {
            console.error(`[SSE] Error sending to client for user ${userId}:`, error);
        }
      });
      console.log(`[SSE] Broadcasted to user ${userId}: ${JSON.stringify(data).substring(0, 100)}...`);
    }
  }
}

export const sseService = new SSEService();
