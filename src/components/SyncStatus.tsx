import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Settings, X } from 'lucide-react';
import { SyncStatus as SyncStatusType, SyncDevice } from '../../electron/services/syncTypes.js';

interface SyncStatusProps {
  status: SyncStatusType;
  devices: SyncDevice[];
  onSyncNow: () => void;
  onResolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => void;
  onOpenSettings: () => void;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  status,
  devices,
  onSyncNow,
  onResolveConflict,
  onOpenSettings
}) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    if (!status.isRunning) {
      return <X className="text-gray-400" size={20} />;
    }
    if (status.lastSyncStatus === 'error') {
      return <AlertCircle className="text-red-500" size={20} />;
    }
    if (status.lastSync) {
      return <CheckCircle className="text-green-500" size={20} />;
    }
    return <Clock className="text-yellow-500" size={20} />;
  };

  const getStatusText = () => {
    if (!status.isRunning) {
      return '同步已禁用';
    }
    if (status.lastSyncStatus === 'error') {
      return '同步失败';
    }
    if (status.lastSync) {
      const lastSyncTime = new Date(status.lastSync).toLocaleString();
      return `上次同步: ${lastSyncTime}`;
    }
    return '等待同步...';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="w-full">
      <div 
        className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 dark:bg-gray-750 rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-600 rounded-full shadow-sm">
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">同步状态</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getStatusText()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSyncNow();
            }}
            className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            title="立即同步"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            title="同步设置"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* 同步统计 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">待同步操作</p>
              <p className="font-medium text-gray-900 dark:text-white text-lg">{status.pendingOperations}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400">冲突数量</p>
              <p className="font-medium text-gray-900 dark:text-white text-lg">{status.conflicts.length}</p>
            </div>
          </div>

          {/* 设备列表 */}
          {devices.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                可用设备
              </h4>
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-750 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {device.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {device.ipAddress} · {formatTimeAgo(device.lastSeen)}
                        </p>
                      </div>
                    </div>
                    <button
                      className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: 触发与该设备的同步
                      }}
                    >
                      同步
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 冲突列表 */}
          {status.conflicts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                同步冲突
              </h4>
              <div className="space-y-3">
                {status.conflicts.map((conflict) => (
                  <div key={conflict.id} className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {conflict.table} · {conflict.recordId}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      本地版本与远程版本冲突
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        className="text-sm px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolveConflict(conflict.id, 'local');
                        }}
                      >
                        保留本地
                      </button>
                      <button
                        className="text-sm px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolveConflict(conflict.id, 'remote');
                        }}
                      >
                        采用远程
                      </button>
                      <button
                        className="text-sm px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolveConflict(conflict.id, 'merge');
                        }}
                      >
                        合并
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
