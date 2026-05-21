import { request, getApiUrl } from './client';
import { useStore } from '@/store/useStore';

export const ttsApi = {
  health: () => request('/ai/tts/health'),
  
  voices: () => request('/ai/tts/voices'),
  
  synthesize: async (data: { text: string; voice?: string; speed?: number; output_format?: string }) => {
    const token = useStore.getState().token;
    const response = await fetch(`${getApiUrl()}/ai/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 401) {
        useStore.getState().setUser(null, null);
      }
      const errorText = await response.text();
      throw new Error(errorText || 'TTS synthesis failed');
    }

    return response.blob();
  },
};
