import { supabaseAdmin } from '../supabase.js';
import { createBackup, cleanupOldSnapshots } from '../services/common/backupService.js';
import { logger } from '../utils/logger.js';
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
async function runAutoBackup(type) {
    if (isRunning) {
        logger.info('Auto backup already running, skipping...');
        return;
    }
    isRunning = true;
    try {
        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('id');
        if (error || !users) {
            logger.error('Failed to fetch users for auto backup:', error);
            return;
        }
        for (const user of users) {
            try {
                const result = await createBackup(supabaseAdmin, user.id, type);
                await cleanupOldSnapshots(supabaseAdmin, user.id, type);
                await supabaseAdmin.from('backup_snapshots').insert({
                    user_id: user.id,
                    type,
                    file_path: result.filePath,
                    file_size: result.fileSize,
                    graphs_count: result.graphsCount,
                    nodes_count: result.nodesCount,
                });
                logger.info(`Auto backup created for user ${user.id}: ${type}`);
            }
            catch (error) {
                logger.error(`Failed to create auto backup for user ${user.id}:`, error);
            }
        }
    }
    catch (error) {
        logger.error('Auto backup failed:', error);
    }
    finally {
        isRunning = false;
    }
}
//# sourceMappingURL=autoBackupScheduler.js.map