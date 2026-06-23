

// 模拟存储配对设备的函数
const STORAGE_KEY = 'paired_devices';

const getPairedDevicesFromStorage = (): PairedDevice[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to get paired devices from storage:', error);
    return [];
  }
};

const savePairedDevicesToStorage = (devices: PairedDevice[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (error) {
    console.warn('Failed to save paired devices to storage:', error);
  }
};

export interface PairedDevice {
  deviceId: string;
  deviceName: string;
  pairedAt: string;
  lastSync?: string;
  sharedSecret: string;
}

class SyncAuthService {
  private pairedDevices: PairedDevice[] = [];
  private pairingCodes: Map<string, { code: string; expiresAt: number }> = new Map();

  constructor() {
    this.loadPairedDevices();
  }

  private async loadPairedDevices(): Promise<void> {
    try {
      const devices = getPairedDevicesFromStorage();
      this.pairedDevices = devices || [];
    } catch (error) {
      console.warn('Failed to load paired devices:', error);
      this.pairedDevices = [];
    }
  }

  private async savePairedDevices(): Promise<void> {
    try {
      savePairedDevicesToStorage(this.pairedDevices);
    } catch (error) {
      console.warn('Failed to save paired devices:', error);
    }
  }

  generatePairingCode(): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = Date.now() + 2 * 60 * 1000; // 2 minutes
    
    this.pairingCodes.set(code, { code, expiresAt });
    
    // Clean up expired codes
    setTimeout(() => {
      this.pairingCodes.delete(code);
    }, 2 * 60 * 1000);
    
    return code;
  }

  async pairDevice(deviceId: string, deviceName: string, pairingCode: string): Promise<boolean> {
    // Validate pairing code
    const codeInfo = this.pairingCodes.get(pairingCode);
    if (!codeInfo || codeInfo.expiresAt < Date.now()) {
      return false;
    }
    
    // Generate shared secret
    const sharedSecret = this.generateSharedSecret();
    
    // Add to paired devices
    const pairedDevice: PairedDevice = {
      deviceId,
      deviceName,
      pairedAt: new Date().toISOString(),
      sharedSecret
    };
    
    this.pairedDevices.push(pairedDevice);
    await this.savePairedDevices();
    
    // Remove used pairing code
    this.pairingCodes.delete(pairingCode);
    
    return true;
  }

  unpairDevice(deviceId: string): boolean {
    const initialLength = this.pairedDevices.length;
    this.pairedDevices = this.pairedDevices.filter(device => device.deviceId !== deviceId);
    
    if (this.pairedDevices.length !== initialLength) {
      this.savePairedDevices();
      return true;
    }
    
    return false;
  }

  getPairedDevices(): PairedDevice[] {
    return this.pairedDevices;
  }

  isDevicePaired(deviceId: string): boolean {
    return this.pairedDevices.some(device => device.deviceId === deviceId);
  }

  async generateSyncToken(deviceId: string): Promise<string | null> {
    const device = this.pairedDevices.find(d => d.deviceId === deviceId);
    if (!device) {
      return null;
    }
    
    const timestamp = Date.now();
    const data = `${deviceId}:${timestamp}`;
    // 使用 HMAC-SHA256 签名
    const signature = await this.hmacSign(data, device.sharedSecret);
    // 格式: base64(data):base64(signature)
    return `${btoa(data)}.${signature}`;
  }

  async validateSyncToken(token: string, deviceId: string): Promise<boolean> {
    try {
      const [encodedData, signature] = token.split('.');
      if (!encodedData || !signature) {
        return false;
      }
      
      const data = atob(encodedData);
      const [tokenDeviceId, timestamp] = data.split(':');
      
      if (tokenDeviceId !== deviceId) {
        return false;
      }
      
      // 检查 token 有效期（10 分钟）
      const tokenTime = parseInt(timestamp);
      if (Date.now() - tokenTime > 10 * 60 * 1000) {
        return false;
      }
      
      // 使用 HMAC-SHA256 验证签名
      const device = this.pairedDevices.find(d => d.deviceId === deviceId);
      if (!device) {
        return false;
      }
      
      const expectedSignature = await this.hmacSign(data, device.sharedSecret);
      return signature === expectedSignature;
    } catch {
      return false;
    }
  }

  updateLastSync(deviceId: string): void {
    const device = this.pairedDevices.find(d => d.deviceId === deviceId);
    if (device) {
      device.lastSync = new Date().toISOString();
      this.savePairedDevices();
    }
  }

  /**
   * 使用 HMAC-SHA256 签名数据
   */
  private async hmacSign(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateSharedSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export const syncAuthService = new SyncAuthService();