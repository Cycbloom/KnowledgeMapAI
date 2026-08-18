import fs from 'fs/promises';
import path from 'path';
import { getSupabaseAdmin, listAuthUserIds } from '../../supabase';
import { logger } from '../../utils/logger';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

export async function syncExistingBackups(): Promise<void> {
  try {
    const { error: tableError } = await getSupabaseAdmin()
      .from('backup_snapshots')
      .select('id')
      .limit(1);

    if (tableError) {
      logger.warn('backup_snapshots table may not exist, skipping sync:', tableError.message);
      return;
    }

    const backupDirExists = await fs.access(BACKUP_DIR).then(() => true).catch(() => false);
    if (!backupDirExists) {
      logger.info('No backup directory found, skipping sync');
      return;
    }

    // 以 auth.users 为权威来源：已删除用户（幽灵）的备份文件不再同步
    const authUserIds = new Set(await listAuthUserIds());

    const userDirs = await fs.readdir(BACKUP_DIR);

    let syncedCount = 0;

    for (const userId of userDirs) {
      if (!authUserIds.has(userId)) continue;
      const userDir = path.join(BACKUP_DIR, userId);
      const stat = await fs.stat(userDir);
      
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(userDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(userDir, file);
        
        const { data: existing } = await getSupabaseAdmin()
          .from('backup_snapshots')
          .select('id')
          .eq('file_path', filePath)
          .single();

        if (existing) continue;

        let type: 'auto_30min' | 'auto_5hour' | 'auto_1day' | 'manual' = 'manual';
        if (file.startsWith('auto_30min')) type = 'auto_30min';
        else if (file.startsWith('auto_5hour')) type = 'auto_5hour';
        else if (file.startsWith('auto_1day')) type = 'auto_1day';

        const fileStat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        await getSupabaseAdmin().from('backup_snapshots').insert({
          user_id: userId,
          type,
          file_path: filePath,
          file_size: fileStat.size,
          graphs_count: data.data?.graphs?.length || 0,
          nodes_count: data.data?.nodes?.length || 0,
          created_at: data.exportedAt || fileStat.birthtime.toISOString(),
        });

        syncedCount++;
      }
    }

    if (syncedCount > 0) {
      logger.info(`Backup sync completed: ${syncedCount} backups synced`);
    } else {
      logger.info('Backup sync completed: no new backups to sync');
    }
  } catch (error) {
    logger.error('Failed to sync existing backups:', error);
  }
}
