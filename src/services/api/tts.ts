import { request, getApiUrl } from './client';
import { useStore } from '@/store/useStore';
import type { TTSVoice } from '@shared/types';
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const ttsApi = {
  health: () =>
    request<{ status: string; model_loaded: boolean; model_name: string }>(
      '/ai/tts/health',
    ),

  voices: async (): Promise<TTSVoice[]> => {
    const result = await request<TTSVoice[]>('/ai/tts/voices');
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
      throw new AppError(errorText || 'TTS synthesis failed', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }

    return response.blob();
  },
};
