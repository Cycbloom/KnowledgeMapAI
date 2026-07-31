import { useStore } from '@/store/useStore';
import { AppError, SharedErrorCodes } from "@/utils/errors";

const API_URL = '/api/v1';

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
  export: async () => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new AppError('Export failed', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    return response.blob();
  },

  getSnapshots: async (): Promise<BackupSnapshot[]> => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/snapshots`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new AppError('Failed to get snapshot list', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    const data = await response.json();
    return data.snapshots || [];
  },

  createSnapshot: async (type: 'manual' = 'manual') => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ type }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || 'Failed to create snapshot', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    return response.json();
  },

  deleteSnapshot: async (id: string) => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/snapshots/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || 'Failed to delete snapshot', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    return response.json();
  },

  restoreSnapshot: async (id: string) => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/restore/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || 'Failed to restore snapshot', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    return response.json();
  },

  import: async (data: unknown, mode: 'merge' | 'replace' = 'merge') => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/import?mode=${encodeURIComponent(mode)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || 'Import failed', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }
    
    return response.json();
  },
};
