

// 模拟存储配对设备的函数
const STORAGE_KEY = 'paired_devices';

const getPairedDevicesFromStorage = (): any[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to get paired devices from storage:', error);
    return [];
  }
};

const savePairedDevicesToStorage = (devices: any[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch (error) {
    console.error('Failed to save paired devices to storage:', error);
  }
};

interface PairedDevice {
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
      console.error('Failed to load paired devices:', error);
      this.pairedDevices = [];
    }
  }

  private async savePairedDevices(): Promise<void> {
    try {
      savePairedDevicesToStorage(this.pairedDevices);
    } catch (error) {
      console.error('Failed to save paired devices:', error);
    }
  }

  generatePairingCode(): string {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
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

  generateSyncToken(deviceId: string): string | null {
    const device = this.pairedDevices.find(d => d.deviceId === deviceId);
    if (!device) {
      return null;
    }
    
    // Generate token using shared secret
    const timestamp = Date.now();
    const data = `${deviceId}:${timestamp}`;
    // In real implementation, we would use the shared secret to sign the token
    // For now, we'll use a simple encoding
    return btoa(`${data}:${device.sharedSecret.substring(0, 8)}`);
  }

  validateSyncToken(token: string, deviceId: string): boolean {
    try {
      const decoded = atob(token);
      const [data, secretPart] = decoded.split(':');
      const [tokenDeviceId, timestamp] = data.split(':');
      
      if (tokenDeviceId !== deviceId) {
        return false;
      }
      
      // Check if token is expired (10 minutes)
      const tokenTime = parseInt(timestamp);
      if (Date.now() - tokenTime > 10 * 60 * 1000) {
        return false;
      }
      
      // Validate secret part
      const device = this.pairedDevices.find(d => d.deviceId === deviceId);
      if (!device || !device.sharedSecret.startsWith(secretPart)) {
        return false;
      }
      
      return true;
    } catch (error) {
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

  private generateSharedSecret(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const syncAuthService = new SyncAuthService();