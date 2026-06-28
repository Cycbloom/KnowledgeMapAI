import { type Server, type IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getSupabaseAdmin } from '../../supabase';
import { getProviderConfig } from '../../services/ai/config';
import { logger } from '../../utils/logger';

export function setupRealtimeSTT(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const userConnections = new Map<string, WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname !== '/api/ai/stt-realtime') {
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // admin client: WebSocket 升级阶段未经过 Express 中间件，无 req.supabase 可用，需使用 admin client 验证 token
    getSupabaseAdmin().auth.getUser(token).then(({ data, error }) => {
      if (error || !data.user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const userId = data.user.id;
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, userId);
      });
    }).catch(() => {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    });
  });

  wss.on('connection', async (clientWs: WebSocket, _request: IncomingMessage, userId: string) => {
    try {
      const oldWs = userConnections.get(userId);
      if (oldWs && oldWs.readyState === WebSocket.OPEN) {
        logger.info(`[STT-Realtime] Replaced existing connection for user ${userId}`);
        oldWs.close(1000, 'replaced');
      }
      const config = await getProviderConfig('aliyun');
      const apiKey = config.apiKey;

      if (!apiKey) {
        clientWs.send(JSON.stringify({ type: 'error', error: { message: 'STT provider not configured' } }));
        clientWs.close();
        return;
      }

      const baseURL = config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      const wsBase = baseURL.replace('https://', 'wss://').replace('http://', 'ws://');
      const wsUrl = `${wsBase.replace('/compatible-mode/v1', '/api-ws/v1/realtime')}?model=qwen3-asr-flash-realtime`;

      const aliyunWs = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      let aliyunReady = false;

      aliyunWs.on('open', () => {
        aliyunReady = true;
        logger.info('[STT-Realtime] Connected to Aliyun ASR');
      });

      aliyunWs.on('message', (data: Buffer) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data.toString());
        }
      });

      clientWs.on('message', (data: Buffer) => {
        if (aliyunReady && aliyunWs.readyState === WebSocket.OPEN) {
          aliyunWs.send(data.toString());
        }
      });

      const cleanup = () => {
        if (aliyunWs.readyState === WebSocket.OPEN || aliyunWs.readyState === WebSocket.CONNECTING) {
          aliyunWs.close();
        }
      };

      clientWs.on('close', () => {
        if (userConnections.get(userId) === clientWs) {
          userConnections.delete(userId);
        }
        cleanup();
      });
      clientWs.on('error', (err) => {
        logger.error('[STT-Realtime] Client WS error:', err);
        if (userConnections.get(userId) === clientWs) {
          userConnections.delete(userId);
        }
        cleanup();
      });

      aliyunWs.on('close', () => {
        logger.info('[STT-Realtime] Aliyun WS closed');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
      });

      aliyunWs.on('error', (err) => {
        logger.error('[STT-Realtime] Aliyun WS error:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', error: { message: 'ASR service error' } }));
          clientWs.close();
        }
      });

      userConnections.set(userId, clientWs);

    } catch (error) {
      logger.error('[STT-Realtime] Setup error:', error);
      clientWs.send(JSON.stringify({ type: 'error', error: { message: 'Internal server error' } }));
      clientWs.close();
    }
  });

  logger.info('[STT-Realtime] WebSocket server initialized on /api/ai/stt-realtime');
}
