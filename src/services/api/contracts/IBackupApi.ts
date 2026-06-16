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

export interface IBackupApi {
  export(): Promise<Blob>;

  getSnapshots(): Promise<BackupSnapshot[]>;

  createSnapshot(type?: 'manual'): Promise<unknown>;

  deleteSnapshot(id: string): Promise<unknown>;

  restoreSnapshot(id: string): Promise<unknown>;

  import(data: unknown, mode?: 'merge' | 'replace'): Promise<unknown>;
}
