export class BackupService {
  async create(options?: { path?: string }): Promise<string> {
    const backupPath = options?.path || '';
    return backupPath;
  }

  async restore(backupPath: string): Promise<void> {
    console.log('Restoring backup from:', backupPath);
  }

  async list(): Promise<string[]> {
    return [];
  }
}

export const backupService = new BackupService();
