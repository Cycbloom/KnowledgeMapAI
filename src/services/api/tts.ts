import { request, getApiUrl } from './client';
import { useStore } from '@/store/useStore';
import type { TTSVoice } from '@shared/types';

export const ttsApi = {
  health: () => request('/ai/tts/health'),

  voices: async (): Promise<TTSVoice[]> => {
    const result = await request('/ai/tts/voices') as TTSVoice[];
    return result;
  },
  
  synthesize: async (data: { text: string; voice?: string; speed?: number; output_format?: string }) => {
    const token = useStore.getState().token;
    const response = await fetch(`${await getApiUrl()}/ai/tts`, {
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
