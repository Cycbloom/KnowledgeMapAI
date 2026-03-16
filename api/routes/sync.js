import { Router } from 'express';
import { syncService } from '../../electron/services/syncService.js';

const router = Router();

// 同步状态获取
router.get('/status', async (req, res) => {
  try {
    const status = await syncService.getStatus();
    const devices = syncService.getDevices();
    res.json({
      status,
      devices
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// 手动触发同步
router.post('/sync', async (req, res) => {
  try {
    const result = await syncService.sync();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// 获取设备列表
router.get('/devices', (req, res) => {
  try {
    const devices = syncService.getDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get devices' });
  }
});

// 与指定设备同步
router.post('/sync/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    // TODO: 实现与指定设备的同步逻辑
    res.json({ success: true, deviceId });
  } catch (error) {
    res.status(500).json({ error: 'Device sync failed' });
  }
});

// 接收同步数据（用于移动端）
router.post('/receive', async (req, res) => {
  try {
    const { deviceId } = req.headers['x-device-id'];
    const token = req.headers['x-sync-token'];
    
    if (!deviceId || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 验证设备和令牌
    if (!syncService.validateSyncToken(token, deviceId)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const batch = req.body;
    // 处理接收到的同步批次
    const processedBatch = await syncService.processSyncBatch(batch);
    
    res.json(processedBatch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to receive sync data' });
  }
});

// 发送同步数据（用于移动端）
router.get('/send', async (req, res) => {
  try {
    const { deviceId } = req.headers['x-device-id'];
    const token = req.headers['x-sync-token'];
    
    if (!deviceId || !token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 验证设备和令牌
    if (!syncService.validateSyncToken(token, deviceId)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // 生成同步批次
    const batch = await syncService.createSyncBatch(deviceId);
    
    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send sync data' });
  }
});

// 解决同步冲突
router.post('/conflicts/:conflictId/resolve', (req, res) => {
  try {
    const { conflictId } = req.params;
    const { resolution } = req.body;
    
    if (!['local', 'remote', 'merge'].includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution' });
    }
    
    syncService.resolveConflict(conflictId, resolution);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

// 获取同步配置
router.get('/config', (req, res) => {
  try {
    const config = syncService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sync config' });
  }
});

// 更新同步配置
router.put('/config', (req, res) => {
  try {
    const config = req.body;
    syncService.updateConfig(config);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sync config' });
  }
});

export default router;
