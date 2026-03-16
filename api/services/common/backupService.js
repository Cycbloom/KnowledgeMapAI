import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_AUTO_SNAPSHOTS = {
    'auto_30min': 5,
    'auto_5hour': 5,
    'auto_1day': 5,
};
async function ensureBackupDir() {
    try {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
    catch (error) {
        logger.error('Failed to create backup directory:', error);
    }
}
export async function createBackup(supabase, userId, type) {
    await ensureBackupDir();
    const [graphsResult, studyCardsResult, studyProgressResult, focusSessionsResult, userAchievementsResult, dailyTasksResult] = await Promise.all([
        supabase.from('knowledge_graphs').select('*').eq('user_id', userId),
        supabase.from('study_cards').select('*').eq('user_id', userId),
        supabase.from('study_progress').select('*').eq('user_id', userId),
        supabase.from('focus_sessions').select('*').eq('user_id', userId),
        supabase.from('user_achievements').select('*').eq('user_id', userId),
        supabase.from('daily_tasks').select('*').eq('user_id', userId),
    ]);
    const graphs = graphsResult.data || [];
    const graphIds = graphs.map((g) => g.id);
    let nodes = [];
    let edges = [];
    if (graphIds.length > 0) {
        const [graphNodesResult, edgesResult] = await Promise.all([
            supabase.from('graph_nodes').select(`
        id,
        graph_id,
        knowledge_point_id,
        x_position,
        y_position,
        level,
        is_accepted,
        created_at,
        updated_at,
        knowledge_points (
          id,
          title,
          content,
          learning_material,
          properties,
          visibility,
          owner_id,
          created_at,
          updated_at
        )
      `).in('graph_id', graphIds).is('deleted_at', null),
            supabase.from('edges').select('*').in('graph_id', graphIds).is('deleted_at', null),
        ]);
        nodes = (graphNodesResult.data || []).map((gn) => ({
            id: gn.knowledge_points?.id || gn.knowledge_point_id,
            graph_id: gn.graph_id,
            graph_node_id: gn.id,
            title: gn.knowledge_points?.title || '',
            content: gn.knowledge_points?.content || '',
            learning_material: gn.knowledge_points?.learning_material || '',
            properties: gn.knowledge_points?.properties || {},
            x_position: gn.x_position,
            y_position: gn.y_position,
            level: gn.level,
            is_accepted: gn.is_accepted,
            knowledge_point_id: gn.knowledge_point_id,
            created_at: gn.created_at,
            updated_at: gn.updated_at,
        }));
        edges = edgesResult.data || [];
    }
    const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        user: { id: userId },
        data: {
            graphs: graphs.map((g) => ({
                id: g.id,
                title: g.title,
                description: g.description,
                settings: g.settings,
                is_public: g.is_public,
                created_at: g.created_at,
                updated_at: g.updated_at,
            })),
            nodes: nodes.map((n) => ({
                id: n.id,
                graph_id: n.graph_id,
                title: n.title,
                content: n.content,
                learning_material: n.learning_material,
                properties: n.properties,
                x_position: n.x_position,
                y_position: n.y_position,
                level: n.level,
                is_accepted: n.is_accepted,
                created_at: n.created_at,
                updated_at: n.updated_at,
            })),
            edges: edges.map((e) => ({
                id: e.id,
                graph_id: e.graph_id,
                source_knowledge_point_id: e.source_knowledge_point_id,
                target_knowledge_point_id: e.target_knowledge_point_id,
                relationship_type: e.relationship_type,
                weight: e.weight,
            })),
            study_cards: (studyCardsResult.data || []).map((c) => ({
                id: c.id,
                graph_id: c.graph_id,
                knowledge_point_id: c.knowledge_point_id,
                question: c.question,
                answer: c.answer,
                explanation: c.explanation,
                card_type: c.card_type,
                options: c.options,
                difficulty: c.difficulty,
                last_reviewed: c.last_reviewed,
                next_review: c.next_review,
                review_count: c.review_count,
                fsrs_state: c.fsrs_state,
                fsrs_stability: c.fsrs_stability,
                fsrs_difficulty: c.fsrs_difficulty,
                fsrs_elapsed_days: c.fsrs_elapsed_days,
                fsrs_scheduled_days: c.fsrs_scheduled_days,
                fsrs_retrievability: c.fsrs_retrievability,
                fsrs_last_review: c.fsrs_last_review,
                created_at: c.created_at,
            })),
            study_progress: studyProgressResult.data || [],
            focus_sessions: focusSessionsResult.data || [],
            user_achievements: userAchievementsResult.data || [],
            daily_tasks: dailyTasksResult.data || [],
        },
    };
    const userDir = path.join(BACKUP_DIR, userId);
    await fs.mkdir(userDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${type}_${timestamp}.json`;
    const filePath = path.join(userDir, fileName);
    const content = JSON.stringify(backupData, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    const stats = await fs.stat(filePath);
    return {
        filePath,
        fileSize: stats.size,
        graphsCount: graphs.length,
        nodesCount: nodes.length,
    };
}
export async function deleteBackupFile(filePath) {
    try {
        await fs.unlink(filePath);
    }
    catch (error) {
        logger.warn('Failed to delete backup file:', error);
    }
}
export async function readBackupFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}
export async function cleanupOldSnapshots(supabase, userId, type) {
    const maxSnapshots = MAX_AUTO_SNAPSHOTS[type] || 5;
    const { data: snapshots } = await supabase
        .from('backup_snapshots')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .order('created_at', { ascending: false });
    if (snapshots && snapshots.length >= maxSnapshots) {
        const toDelete = snapshots.slice(maxSnapshots - 1);
        for (const snapshot of toDelete) {
            await deleteBackupFile(snapshot.file_path);
            await supabase.from('backup_snapshots').delete().eq('id', snapshot.id);
        }
    }
}
export async function runAutoBackup(supabaseUrl, supabaseKey, type) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: users } = await supabase
        .from('users')
        .select('id');
    if (!users)
        return;
    for (const user of users) {
        try {
            const result = await createBackup(supabase, user.id, type);
            await cleanupOldSnapshots(supabase, user.id, type);
            await supabase.from('backup_snapshots').insert({
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
export class BackupService {
    async getSnapshots(supabase, userId) {
        const { data, error } = await supabase
            .from('backup_snapshots')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async createSnapshotRecord(supabase, userId, data) {
        const { data: snapshot, error } = await supabase
            .from('backup_snapshots')
            .insert({
            user_id: userId,
            ...data,
        })
            .select()
            .single();
        if (error)
            throw error;
        return snapshot;
    }
    async getSnapshot(supabase, snapshotId, userId) {
        const { data, error } = await supabase
            .from('backup_snapshots')
            .select('*')
            .eq('id', snapshotId)
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return data;
    }
    async deleteSnapshot(supabase, snapshotId, userId) {
        const snapshot = await this.getSnapshot(supabase, snapshotId, userId);
        if (!snapshot) {
            throw new Error('Snapshot not found');
        }
        await deleteBackupFile(snapshot.file_path);
        const { error } = await supabase
            .from('backup_snapshots')
            .delete()
            .eq('id', snapshotId)
            .eq('user_id', userId);
        if (error)
            throw error;
    }
}
export const backupService = new BackupService();
//# sourceMappingURL=backupService.js.map