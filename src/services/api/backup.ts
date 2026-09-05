import { request, requestBlob } from './client';

export interface BackupSnapshot {
  id: string;
  user_id: string;
  type: 'auto_30min' | 'auto_5hour' | 'auto_1day' | 'manual';
  file_path: string;
  file_size: number;
  graphs_count: number;
  nodes_count: number;
  created_at: string;
}

export const backupApi = {
  /** 导出全量备份（blob，由调用方触发下载） */
  export: (): Promise<Blob> => requestBlob('/backup/export'),

  getSnapshots: async (): Promise<BackupSnapshot[]> => {
    const data = await request<{ snapshots?: BackupSnapshot[] }>('/backup/snapshots');
    return data.snapshots || [];
  },

  createSnapshot: (type: 'manual' = 'manual') =>
    request('/backup/snapshots', {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  deleteSnapshot: (id: string) =>
    request(`/backup/snapshots/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  restoreSnapshot: (id: string) =>
    request(`/backup/restore/${encodeURIComponent(id)}`, {
      method: 'POST',
    }),

  import: (data: unknown, mode: 'merge' | 'replace' = 'merge') =>
    request(`/backup/import?mode=${encodeURIComponent(mode)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
