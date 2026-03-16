import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  Wifi,
  Cloud,
  Save,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SyncStatus as SyncStatusComponent } from "../components/SyncStatus.js";
import { useMobileSync } from "../hooks/useMobileSync";

const SyncSettings: React.FC = () => {
  const navigate = useNavigate();
  const {
    syncStatus,
    isInitialized,
    fetchSyncStatus,
    syncNow,
    generatePairingCode: generateMobilePairingCode,
    unpairDevice,
    getDevices,
    getPairedDevices,
  } = useMobileSync();

  const [devices, setDevices] = useState<any[]>([]);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  // 生成设备名称的函数
  const generateDeviceName = () => {
    return `Device-${Math.random().toString(36).substr(2, 9)}`;
  };

  const [syncConfig, setSyncConfig] = useState(() => ({
    enabled: false,
    autoSync: true,
    syncInterval: 15,
    syncMode: "lan" as "lan" | "cloud",
    lanPort: 3001,
    deviceName: generateDeviceName(),
  }));
  const [pairingCode, setPairingCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "status",
  );

  // 获取同步配置
  const fetchSyncConfig = async () => {
    try {
      const response = await fetch("/api/sync/config");
      const data = await response.json();
      setSyncConfig(data);
    } catch (error) {
      console.error("Failed to fetch sync config:", error);
    }
  };

  // 刷新设备列表
  const refreshDevices = () => {
    setDevices(getDevices());
    setPairedDevices(getPairedDevices());
  };

  useEffect(() => {
    if (isInitialized) {
      fetchSyncStatus();
      refreshDevices();
    }
    fetchSyncConfig();
  }, [isInitialized, fetchSyncStatus]);

  const handleSyncNow = async () => {
    await syncNow();
  };

  const handleConfigUpdate = async () => {
    try {
      const response = await fetch("/api/sync/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(syncConfig),
      });
      const data = await response.json();
      if (data.success) {
        // 配置更新成功
      }
    } catch (error) {
      console.error("Failed to update sync config:", error);
    }
  };

  const handlePairDevice = () => {
    // 生成配对码
    const code = generateMobilePairingCode();
    setPairingCode(code);
    setIsPairing(true);
  };

  const handleUnpairDevice = async (deviceId: string) => {
    await unpairDevice(deviceId);
    refreshDevices();
  };

  const handleResolveConflict = async (
    conflictId: string,
    resolution: "local" | "remote" | "merge",
  ) => {
    try {
      const response = await fetch(
        `/api/sync/conflicts/${conflictId}/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ resolution }),
        },
      );
      const data = await response.json();
      if (data.success) {
        fetchSyncStatus();
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 移动端头部 */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            同步设置
          </h1>
          <button
            onClick={() => navigate("/settings")}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 同步状态 */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection("status")}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              同步状态
            </h2>
            {expandedSection === "status" ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
          {expandedSection === "status" && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <SyncStatusComponent
                status={syncStatus}
                devices={devices}
                onSyncNow={handleSyncNow}
                onResolveConflict={handleResolveConflict}
                onOpenSettings={() => toggleSection("config")}
              />
            </div>
          )}
        </div>

        {/* 同步配置 */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection("config")}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              同步配置
            </h2>
            {expandedSection === "config" ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
          {expandedSection === "config" && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-6">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={syncConfig.enabled}
                    onChange={(e) =>
                      setSyncConfig({
                        ...syncConfig,
                        enabled: e.target.checked,
                      })
                    }
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    启用同步
                  </span>
                </label>
                {syncConfig.enabled ? (
                  <CheckCircle className="text-green-500" size={20} />
                ) : (
                  <X className="text-gray-400" size={20} />
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={syncConfig.autoSync}
                    onChange={(e) =>
                      setSyncConfig({
                        ...syncConfig,
                        autoSync: e.target.checked,
                      })
                    }
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    自动同步
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  同步间隔（分钟）
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      setSyncConfig({
                        ...syncConfig,
                        syncInterval: Math.max(5, syncConfig.syncInterval - 5),
                      })
                    }
                    className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-gray-900 dark:text-white font-medium text-lg min-w-[40px] text-center">
                    {syncConfig.syncInterval}
                  </span>
                  <button
                    onClick={() =>
                      setSyncConfig({
                        ...syncConfig,
                        syncInterval: Math.min(
                          120,
                          syncConfig.syncInterval + 5,
                        ),
                      })
                    }
                    className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  同步模式
                </label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                    <input
                      type="radio"
                      name="syncMode"
                      value="lan"
                      checked={syncConfig.syncMode === "lan"}
                      onChange={() =>
                        setSyncConfig({ ...syncConfig, syncMode: "lan" })
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Wifi size={18} />
                      局域网同步
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                    <input
                      type="radio"
                      name="syncMode"
                      value="cloud"
                      checked={syncConfig.syncMode === "cloud"}
                      onChange={() =>
                        setSyncConfig({ ...syncConfig, syncMode: "cloud" })
                      }
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Cloud size={18} />
                      云同步
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  设备名称
                </label>
                <input
                  type="text"
                  value={syncConfig.deviceName}
                  onChange={(e) =>
                    setSyncConfig({ ...syncConfig, deviceName: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-750 dark:text-white text-base"
                />
              </div>

              {syncConfig.syncMode === "lan" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    局域网端口
                  </label>
                  <input
                    type="number"
                    value={syncConfig.lanPort}
                    onChange={(e) =>
                      setSyncConfig({
                        ...syncConfig,
                        lanPort: parseInt(e.target.value) || 3001,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-750 dark:text-white text-base"
                  />
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleConfigUpdate}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-base font-medium"
                >
                  <Save size={18} />
                  保存配置
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 设备管理 */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection("devices")}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              设备管理
            </h2>
            {expandedSection === "devices" ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </div>
          {expandedSection === "devices" && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  可用设备
                </h3>
                <button
                  onClick={refreshDevices}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RefreshCw size={16} />
                  刷新
                </button>
              </div>

              {devices.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  未发现其他设备
                </div>
              ) : (
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full ${device.status === "online" ? "bg-green-500" : "bg-gray-400"}`}
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {device.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {device.ipAddress}
                          </p>
                        </div>
                      </div>
                      <button
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        onClick={handlePairDevice}
                      >
                        配对
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  已配对设备
                </h3>
                {pairedDevices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    暂无已配对设备
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pairedDevices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {device.deviceName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            配对时间:{" "}
                            {new Date(device.pairedAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                          onClick={() => handleUnpairDevice(device.deviceId)}
                        >
                          解除配对
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 配对模式 */}
        {isPairing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
                设备配对
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-center">
                在另一台设备上输入以下配对码以完成配对：
              </p>
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-widest p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
                  {pairingCode}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  配对码将在 2 分钟后过期
                </p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setIsPairing(false)}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 w-full"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncSettings;
