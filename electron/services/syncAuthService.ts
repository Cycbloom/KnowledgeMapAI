import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

interface DeviceCredential {
  deviceId: string;
  deviceName: string;
  sharedSecret: string;
  pairedAt: string;
  lastSyncAt?: string;
}

export class SyncAuthService {
  private credentialsPath: string;
  private credentials: Map<string, DeviceCredential> = new Map();
  private deviceId: string;
  private deviceName: string;

  constructor(deviceId: string, deviceName: string, dataPath: string) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.credentialsPath = path.join(dataPath, "sync-credentials.json");
    this.loadCredentials();
  }

  private loadCredentials(): void {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const content = fs.readFileSync(this.credentialsPath, "utf-8");
        const data = JSON.parse(content);
        this.credentials = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error("Failed to load sync credentials:", error);
    }
  }

  private saveCredentials(): void {
    try {
      const data = Object.fromEntries(this.credentials);
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.credentialsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save sync credentials:", error);
    }
  }

  generatePairingCode(): string {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  generateSharedSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  pairDevice(
    deviceId: string,
    deviceName: string,
    sharedSecret: string,
  ): boolean {
    if (this.credentials.has(deviceId)) {
      return false; // Device already paired
    }

    this.credentials.set(deviceId, {
      deviceId,
      deviceName,
      sharedSecret,
      pairedAt: new Date().toISOString(),
    });

    this.saveCredentials();
    return true;
  }

  unpairDevice(deviceId: string): boolean {
    const result = this.credentials.delete(deviceId);
    if (result) {
      this.saveCredentials();
    }
    return result;
  }

  generateSyncToken(deviceId: string): string | null {
    const credential = this.credentials.get(deviceId);
    if (!credential) {
      return null;
    }

    const payload = {
      deviceId: this.deviceId,
      targetDeviceId: deviceId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    const signature = this.signPayload(payload, credential.sharedSecret);
    return Buffer.from(JSON.stringify({ ...payload, signature })).toString(
      "base64",
    );
  }

  validateSyncToken(token: string, deviceId: string): boolean {
    try {
      const credential = this.credentials.get(deviceId);
      if (!credential) {
        return false;
      }

      const decoded = JSON.parse(
        Buffer.from(token, "base64").toString("utf-8"),
      );
      const { signature, ...payload } = decoded;

      const expectedSignature = this.signPayload(
        payload,
        credential.sharedSecret,
      );
      return signature === expectedSignature;
    } catch (error) {
      console.error("Failed to validate sync token:", error);
      return false;
    }
  }

  private signPayload(payload: any, secret: string): string {
    const data = JSON.stringify(payload);
    return crypto.createHmac("sha256", secret).update(data).digest("hex");
  }

  getPairedDevices(): DeviceCredential[] {
    return Array.from(this.credentials.values());
  }

  isDevicePaired(deviceId: string): boolean {
    return this.credentials.has(deviceId);
  }

  updateLastSync(deviceId: string): void {
    const credential = this.credentials.get(deviceId);
    if (credential) {
      this.credentials.set(deviceId, {
        ...credential,
        lastSyncAt: new Date().toISOString(),
      });
      this.saveCredentials();
    }
  }

  getDeviceCredential(deviceId: string): DeviceCredential | undefined {
    return this.credentials.get(deviceId);
  }
}
