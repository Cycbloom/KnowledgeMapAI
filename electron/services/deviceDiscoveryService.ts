import * as dgram from "dgram";
import { SyncDevice } from "./syncTypes.js";

const DISCOVERY_PORT = 5000;
const BROADCAST_INTERVAL = 5000; // 5 seconds
const DEVICE_TIMEOUT = 30000; // 30 seconds

export class DeviceDiscoveryService {
  private socket: dgram.Socket | null = null;
  private devices: Map<string, SyncDevice> = new Map();
  private broadcastInterval: NodeJS.Timeout | null = null;
  private deviceTimeoutIntervals: Map<string, NodeJS.Timeout> = new Map();
  private deviceId: string;
  private deviceName: string;

  constructor(deviceId: string, deviceName: string) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket("udp4");

        this.socket.on("error", (err) => {
          console.error("Device discovery error:", err);
          this.socket?.close();
          this.socket = null;
          reject(err);
        });

        this.socket.on("message", (message, rinfo) => {
          this.handleMessage(message, rinfo);
        });

        this.socket.on("listening", () => {
          const address = this.socket?.address();
          console.log(
            `Device discovery service started on ${address?.address}:${address?.port}`,
          );
          this.startBroadcasting();
          resolve();
        });

        this.socket.bind(DISCOVERY_PORT);
      } catch (error) {
        console.error("Failed to start device discovery:", error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    this.deviceTimeoutIntervals.forEach((interval) => clearTimeout(interval));
    this.deviceTimeoutIntervals.clear();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.devices.clear();
    console.log("Device discovery service stopped");
  }

  private startBroadcasting(): void {
    this.broadcastInterval = setInterval(() => {
      this.broadcastDeviceInfo();
    }, BROADCAST_INTERVAL);
  }

  private broadcastDeviceInfo(): void {
    if (!this.socket) return;

    const deviceInfo = {
      type: "KNOWLEDGE_MAP_DEVICE",
      id: this.deviceId,
      name: this.deviceName,
      timestamp: Date.now(),
      version: "1.0.0",
    };

    const message = Buffer.from(JSON.stringify(deviceInfo));

    this.socket.send(
      message,
      0,
      message.length,
      DISCOVERY_PORT,
      "255.255.255.255",
      (err) => {
        if (err) {
          console.error("Failed to send broadcast:", err);
        }
      },
    );
  }

  private handleMessage(message: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "KNOWLEDGE_MAP_DEVICE" && data.id !== this.deviceId) {
        this.updateDevice({
          id: data.id,
          name: data.name,
          ipAddress: rinfo.address,
          lastSeen: new Date().toISOString(),
          status: "online" as const,
        });
      }
    } catch (error) {
      console.error("Failed to parse discovery message:", error);
    }
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
        status: "offline" as const,
      });
    }
  }

  getDevices(): SyncDevice[] {
    return Array.from(this.devices.values());
  }

  getOnlineDevices(): SyncDevice[] {
    return Array.from(this.devices.values()).filter(
      (device) => device.status === "online",
    );
  }

  async discoverDevices(): Promise<SyncDevice[]> {
    // Clear existing devices
    this.devices.clear();
    this.deviceTimeoutIntervals.forEach((interval) => clearTimeout(interval));
    this.deviceTimeoutIntervals.clear();

    // Send a broadcast and wait for responses
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(this.getOnlineDevices());
      }, 3000); // Wait 3 seconds for responses

      this.broadcastDeviceInfo();
    });
  }

  async isDeviceOnline(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    return device?.status === "online";
  }

  async getDeviceById(deviceId: string): Promise<SyncDevice | undefined> {
    return this.devices.get(deviceId);
  }
}
