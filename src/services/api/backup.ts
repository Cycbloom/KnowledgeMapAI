import { useStore } from '../../store/useStore';

const API_URL = '/api';

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

  import: async (data: any) => {
    const token = useStore.getState().token;
    const response = await fetch(`${API_URL}/backup/import`, {
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
