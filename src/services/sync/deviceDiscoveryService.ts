import type { SyncDevice } from '../../../shared/sync';
import { logger } from '@/utils/logger';

const BROADCAST_INTERVAL = 5000;
const DEVICE_TIMEOUT = 30000;

interface DeviceBroadcastInfo {
  type: string;
  id: string;
  name: string;
}

class DeviceDiscoveryService {
  private devices: Map<string, SyncDevice> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private deviceTimeoutIntervals: Map<string, NodeJS.Timeout> = new Map();
  private deviceId: string = '';
  private deviceName: string = '';
  private visibilityHandler: (() => void) | null = null;

  async start(deviceId: string, _deviceName: string): Promise<void> {
    this.deviceId = deviceId;
    this.deviceName = _deviceName;
    await this.registerDevice();
    this.startPolling();
  }

  async stop(): Promise<void> {
    this.stopPolling();

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.deviceTimeoutIntervals.forEach(interval => clearTimeout(interval));
    this.deviceTimeoutIntervals.clear();
    this.devices.clear();
  }

  private startPolling(): void {
    this.resumePolling();

    // 页面隐藏时暂停广播轮询，恢复可见时立即拉取并继续
    if (this.visibilityHandler) {
      return;
    }
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.resumePolling();
      } else {
        this.stopPolling();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopPolling(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  private resumePolling(): void {
    if (!this.broadcastInterval) {
      this.broadcastInterval = setInterval(() => {
        this.pollForDevices();
      }, BROADCAST_INTERVAL);
      void this.pollForDevices();
    }
  }

  private async pollForDevices(): Promise<void> {
    try {
      // 通过后端 API 查询在线设备
      const response = await fetch('/api/v1/sync/devices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const { devices } = await response.json() as { devices: SyncDevice[] };
        for (const device of devices) {
          if (device.id !== this.deviceId) {
            this.updateDevice(device);
          }
        }
      }
    } catch (error) {
      logger.warn("Operation failed", {
        operation: "discoverDevices",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async registerDevice(): Promise<void> {
    try {
      await fetch('/api/v1/sync/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          deviceName: this.deviceName,
        }),
      });
    } catch (error) {
      logger.warn("Operation failed", {
        operation: "registerDevice",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 手动添加设备（用于配对时）
  addDevice(device: SyncDevice): void {
    this.updateDevice(device);
  }

  private updateDevice(device: SyncDevice): void {
    this.devices.set(device.id, device);

    // Reset timeout for this device
    const existingTimeout = this.deviceTimeoutIntervals.get(device.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.markDeviceAsOffline(device.id);
    }, DEVICE_TIMEOUT);

    this.deviceTimeoutIntervals.set(device.id, timeout);
  }

  private markDeviceAsOffline(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.devices.set(deviceId, {
        ...device,
        status: 'offline' as const
      });
    }
  }

  getDevices(): SyncDevice[] {
    return Array.from(this.devices.values());
  }

  getOnlineDevices(): SyncDevice[] {
    return Array.from(this.devices.values()).filter(device => device.status === 'online');
  }

  async discoverDevices(): Promise<SyncDevice[]> {
    await this.pollForDevices();
    return this.getOnlineDevices();
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    return device?.status === 'online';
  }

  async getDeviceById(deviceId: string): Promise<SyncDevice | undefined> {
    return this.devices.get(deviceId);
  }

  // 模拟接收设备广播（实际实现中可能需要通过WebSocket或其他方式）
  handleDeviceBroadcast(deviceInfo: DeviceBroadcastInfo, ipAddress: string): void {
    if (deviceInfo.type === 'KNOWLEDGE_MAP_DEVICE' && deviceInfo.id !== this.deviceId) {
      this.updateDevice({
        id: deviceInfo.id,
        name: deviceInfo.name,
        ipAddress,
        lastSeen: new Date().toISOString(),
        status: 'online' as const
      });
    }
  }
}

export const deviceDiscoveryService = new DeviceDiscoveryService();
