import { logger } from "../../utils/logger";

interface DeviceInfo {
  id: string;
  name: string;
  userId: string;
  lastSeen: string;
  ipAddress?: string;
}

class P2PSyncService {
  // 内存存储在线设备
  private devices: Map<string, DeviceInfo> = new Map();
  private readonly DEVICE_TIMEOUT = 5 * 60 * 1000; // 5 分钟超时

  /**
   * 注册或更新设备
   */
  registerDevice(deviceId: string, deviceName: string, userId: string, ipAddress?: string): void {
    this.devices.set(deviceId, {
      id: deviceId,
      name: deviceName,
      userId,
      lastSeen: new Date().toISOString(),
      ipAddress,
    });
    logger.info(`设备已注册: ${deviceId} (${deviceName}), 用户: ${userId}`);
  }

  /**
   * 获取在线设备列表
   */
  getOnlineDevices(userId: string): DeviceInfo[] {
    this.cleanupExpiredDevices();
    return Array.from(this.devices.values()).filter(
      (d) => d.userId === userId && Date.now() - new Date(d.lastSeen).getTime() < this.DEVICE_TIMEOUT,
    );
  }

  /**
   * 清理过期设备
   */
  private cleanupExpiredDevices(): void {
    const now = Date.now();
    for (const [id, device] of this.devices) {
      if (now - new Date(device.lastSeen).getTime() > this.DEVICE_TIMEOUT) {
        this.devices.delete(id);
      }
    }
  }
}

export const p2pSyncService = new P2PSyncService();
