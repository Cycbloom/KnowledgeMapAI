import { getSupabaseAdmin, listAuthUserIds } from '../supabase';
import { createBackup, cleanupOldSnapshots, deleteBackupFile } from '../services/common/backupService';
import { logger } from '../utils/logger';

const THIRTY_MINUTES = 30 * 60 * 1000;
const FIVE_HOURS = 5 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

let isRunning = false;

export function startAutoBackupScheduler() {
  logger.info('Starting auto backup scheduler...');

  setInterval(async () => {
    await runAutoBackup('auto_30min');
  }, THIRTY_MINUTES);

  setInterval(async () => {
    await runAutoBackup('auto_5hour');
  }, FIVE_HOURS);

  setInterval(async () => {
    await runAutoBackup('auto_1day');
  }, ONE_DAY);

  setTimeout(() => {
    runAutoBackup('auto_1day');
  }, 60000);

  logger.info('Auto backup scheduler started');
}

/**
 * 以 auth.users 为权威来源遍历用户创建备份：
 * public.users 可能残留已删除用户（幽灵行），为其创建备份会持续产生无效数据。
 */
async function runAutoBackup(type: 'auto_30min' | 'auto_5hour' | 'auto_1day') {
  if (isRunning) {
    logger.info('Auto backup already running, skipping...');
    return;
  }

  isRunning = true;

  try {
    const userIds = await listAuthUserIds();

    for (const userId of userIds) {
      try {
        const result = await createBackup(getSupabaseAdmin(), userId, type);

        await cleanupOldSnapshots(getSupabaseAdmin(), userId, type);

        try {
          await getSupabaseAdmin().from('backup_snapshots').insert({
            user_id: userId,
            type,
            file_path: result.filePath,
            file_size: result.fileSize,
            graphs_count: result.graphsCount,
            nodes_count: result.nodesCount,
          });
        } catch (error) {
          // 记录写入失败时补偿清理已落盘的文件，避免产生孤儿文件
          await deleteBackupFile(result.filePath);
          throw error;
        }

        logger.info(`Auto backup created for user ${userId}: ${type}`);
      } catch (error) {
        logger.error(`Failed to create auto backup for user ${userId}:`, error);
      }
    }
  } catch (error) {
    logger.error('Auto backup failed:', error);
  } finally {
    isRunning = false;
  }
}
