import { SyncDevice } from './syncTypes';

const BROADCAST_INTERVAL = 5000; // 5 seconds
const DEVICE_TIMEOUT = 30000; // 30 seconds

class DeviceDiscoveryService {
  private devices: Map<string, SyncDevice> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private deviceTimeoutIntervals: Map<string, NodeJS.Timeout> = new Map();
  private deviceId: string = '';

  async start(deviceId: string, _deviceName: string): Promise<void> {
    this.deviceId = deviceId;
    
    // 在浏览器环境中，我们使用不同的方法进行设备发现
    // 由于浏览器限制，我们无法直接使用UDP广播
    // 所以我们使用定时轮询的方式
    this.startPolling();
    console.log('Mobile device discovery service started');
  }

  async stop(): Promise<void> {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    this.deviceTimeoutIntervals.forEach(interval => clearTimeout(interval));
    this.deviceTimeoutIntervals.clear();
    this.devices.clear();
    console.log('Mobile device discovery service stopped');
  }

  private startPolling(): void {
    this.broadcastInterval = setInterval(() => {
      this.pollForDevices();
    }, BROADCAST_INTERVAL);
  }

  private async pollForDevices(): Promise<void> {
    // 在实际实现中，这里可以：
    // 1. 尝试连接到常见的局域网IP地址范围
    // 2. 使用WebRTC进行设备发现
    // 3. 或者使用其他浏览器兼容的设备发现方法
    
    // 这里我们模拟设备发现，实际实现需要根据浏览器环境进行调整
    console.log('Polling for devices...');
    
    // 模拟发现设备
    // 实际实现中，这里应该是真实的设备发现逻辑
  }

  // 手动添加设备（用于配对时）
  addDevice(device: SyncDevice): void {
    this.updateDevice(device);
  }

  private updateDevice(device: SyncDevice): void {
    this.devices.set(device.id, device);

    // Reset timeout for this device
    if (this.deviceTimeoutIntervals.has(device.id)) {
      clearTimeout(this.deviceTimeoutIntervals.get(device.id)!);
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
    // 这里应该实现真实的设备发现逻辑
    // 由于浏览器限制，我们可能需要使用不同的方法
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
  handleDeviceBroadcast(deviceInfo: any, ipAddress: string): void {
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