import { useStore } from '@/store/useStore';

const API_URL = '/api';

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
      throw new Error('导出失败');
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
      throw new Error('获取快照列表失败');
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
      throw new Error(errorData.error || '创建快照失败');
    }
    
    return response.json();
  },

  deleteSnapshot: async (id: string) => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/snapshots/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '删除快照失败');
    }
    
    return response.json();
  },

  restoreSnapshot: async (id: string) => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/restore/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '恢复快照失败');
    }
    
    return response.json();
  },

  import: async (data: any, mode: 'merge' | 'replace' = 'merge') => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/import?mode=${mode}`, {
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
      throw new Error(errorData.error || '导入失败');
    }
    
    return response.json();
  },
};
