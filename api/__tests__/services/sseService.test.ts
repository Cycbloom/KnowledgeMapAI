import { Response } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sseService } from '../../services/core/sseService';
import { createMockResponse } from '../../../tests/helpers/mockFactories';

describe('SSE Service', () => {
  beforeEach(() => {
    // 清理所有客户端状态（私有字段需通过类型断言访问）
    const internal = sseService as unknown as {
      clients: Map<string, Response[]>;
      writeFailures: Map<Response, number>;
    };
    internal.clients.clear();
    internal.writeFailures.clear();
    // 停止模块加载时自动启动的心跳定时器
    sseService.stopHeartbeat();
  });

  afterEach(() => {
    // 停止心跳避免定时器泄漏
    sseService.stopHeartbeat();
    vi.useRealTimers();
  });

  describe('连接数限制', () => {
    it('连接数未达上限时接受 addClient', () => {
      const res = createMockResponse(true);
      const result = sseService.addClient('user1', res);
      expect(result).toBe(true);

      // 验证可以通过 sendToUser 触发 write
      sseService.sendToUser('user1', { msg: 'hello' });
      expect(res.write).toHaveBeenCalled();
    });

    it('连接数达上限时拒绝 addClient', () => {
      const clients: Response[] = [];
      // 前 5 次返回 true
      for (let i = 0; i < 5; i++) {
        const res = createMockResponse(true);
        const result = sseService.addClient('user1', res);
        expect(result).toBe(true);
        clients.push(res);
      }
      // 第 6 次返回 false
      const sixth = createMockResponse(true);
      const result = sseService.addClient('user1', sixth);
      expect(result).toBe(false);

      // 第 6 个客户端不应收到消息
      sseService.sendToUser('user1', { msg: 'hello' });
      expect(sixth.write).not.toHaveBeenCalled();
    });

    it('连接关闭后可重新建立', () => {
      const clients: Response[] = [];
      for (let i = 0; i < 5; i++) {
        const res = createMockResponse(true);
        sseService.addClient('user1', res);
        clients.push(res);
      }
      // 移除一个连接
      sseService.removeClient('user1', clients[0]);
      // 再次添加应成功
      const newRes = createMockResponse(true);
      const result = sseService.addClient('user1', newRes);
      expect(result).toBe(true);
    });
  });

  describe('死连接剔除', () => {
    it('写入失败累计达到阈值后剔除', () => {
      const res = createMockResponse(false);
      sseService.addClient('user1', res);

      // 连续 3 次 sendToUser，每次 write 返回 false
      sseService.sendToUser('user1', { msg: 1 });
      sseService.sendToUser('user1', { msg: 2 });
      // 前两次未达阈值，end 不应被调用
      expect(res.end).not.toHaveBeenCalled();

      sseService.sendToUser('user1', { msg: 3 });
      // 第 3 次后达到阈值，end 应被调用
      expect(res.end).toHaveBeenCalledTimes(1);

      // 客户端应从 clients Map 中移除，再 sendToUser 不会触发 write
      (res.write as ReturnType<typeof vi.fn>).mockClear();
      sseService.sendToUser('user1', { msg: 4 });
      expect(res.write).not.toHaveBeenCalled();
    });

    it('中途成功重置失败计数', () => {
      const res = createMockResponse(false);
      sseService.addClient('user1', res);

      // 2 次失败（失败计数=2）
      sseService.sendToUser('user1', { msg: 1 });
      sseService.sendToUser('user1', { msg: 2 });
      expect(res.end).not.toHaveBeenCalled();

      // 修改 write 返回 true，失败计数重置为 0
      (res.write as ReturnType<typeof vi.fn>).mockReturnValue(true);
      sseService.sendToUser('user1', { msg: 3 });

      // 再修改 write 返回 false，2 次失败（未达阈值 3）
      (res.write as ReturnType<typeof vi.fn>).mockReturnValue(false);
      sseService.sendToUser('user1', { msg: 4 });
      sseService.sendToUser('user1', { msg: 5 });

      // end 不应被调用
      expect(res.end).not.toHaveBeenCalled();
    });
  });

  describe('心跳定时器', () => {
    it('stopHeartbeat 清除定时器', () => {
      vi.useFakeTimers();

      const res = createMockResponse(true);
      sseService.addClient('user1', res);

      sseService.startHeartbeat(100);
      sseService.stopHeartbeat();

      // 推进时间，心跳不应再触发 write
      (res.write as ReturnType<typeof vi.fn>).mockClear();
      vi.advanceTimersByTime(500);
      expect(res.write).not.toHaveBeenCalled();
    });

    it('stopHeartbeat 未启动时无副作用', () => {
      // 直接调用 stopHeartbeat 不应抛异常
      expect(() => sseService.stopHeartbeat()).not.toThrow();
    });
  });
});
