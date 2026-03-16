import { useState, useEffect, useCallback } from "react";
import { mobileSyncService } from "../services/sync/mobileSyncService";
import { SyncOperation } from "../services/sync/syncTypes";

export const useMobileSync = () => {
  const [syncStatus, setSyncStatus] = useState<any>({
    isRunning: false,
    lastSync: null,
    lastSyncStatus: null,
    pendingOperations: 0,
    conflicts: [],
    devices: [],
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // 获取同步状态
  const fetchSyncStatus = useCallback(async () => {
    try {
      const status = await mobileSyncService.getStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error("Failed to fetch sync status:", error);
    }
  }, []);

  // 初始化同步服务
  useEffect(() => {
    const initSync = async () => {
      try {
        await mobileSyncService.start();
        setIsInitialized(true);
        await fetchSyncStatus();
      } catch (error) {
        console.error("Failed to initialize sync service:", error);
      }
    };

    initSync();

    return () => {
      mobileSyncService.stop();
    };
  }, [fetchSyncStatus]);

  // 手动触发同步
  const syncNow = useCallback(async () => {
    try {
      await mobileSyncService.sync();
      await fetchSyncStatus();
    } catch (error) {
      console.error("Failed to sync:", error);
    }
  }, [fetchSyncStatus]);

  // 添加同步操作
  const addSyncOperation = useCallback(
    async (operation: SyncOperation) => {
      try {
        await mobileSyncService.addOperation(operation);
        await fetchSyncStatus();
      } catch (error) {
        console.error("Failed to add sync operation:", error);
      }
    },
    [fetchSyncStatus],
  );

  // 生成配对码
  const generatePairingCode = useCallback(() => {
    return mobileSyncService.generatePairingCode();
  }, []);

  // 配对设备
  const pairDevice = useCallback(
    async (deviceId: string, deviceName: string, pairingCode: string) => {
      try {
        const success = await mobileSyncService.pairDevice(
          deviceId,
          deviceName,
          pairingCode,
        );
        if (success) {
          await fetchSyncStatus();
        }
        return success;
      } catch (error) {
        console.error("Failed to pair device:", error);
        return false;
      }
    },
    [fetchSyncStatus],
  );

  // 解除配对
  const unpairDevice = useCallback(
    async (deviceId: string) => {
      try {
        const success = mobileSyncService.unpairDevice(deviceId);
        if (success) {
          await fetchSyncStatus();
        }
        return success;
      } catch (error) {
        console.error("Failed to unpair device:", error);
        return false;
      }
    },
    [fetchSyncStatus],
  );

  // 获取设备列表
  const getDevices = useCallback(() => {
    return mobileSyncService.getDevices();
  }, []);

  // 获取已配对设备
  const getPairedDevices = useCallback(() => {
    return mobileSyncService.getPairedDevices();
  }, []);

  // 检查设备是否已配对
  const isDevicePaired = useCallback((deviceId: string) => {
    return mobileSyncService.isDevicePaired(deviceId);
  }, []);

  return {
    syncStatus,
    isInitialized,
    fetchSyncStatus,
    syncNow,
    addSyncOperation,
    generatePairingCode,
    pairDevice,
    unpairDevice,
    getDevices,
    getPairedDevices,
    isDevicePaired,
  };
};
