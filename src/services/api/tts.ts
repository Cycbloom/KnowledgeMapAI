import { request, requestBlob } from './client';
import type { TTSVoice } from '@shared/types';

export const ttsApi = {
  health: () =>
    request<{ status: string; model_loaded: boolean; model_name: string }>(
      '/ai/tts/health',
    ),

  voices: async (): Promise<TTSVoice[]> => {
    const result = await request<TTSVoice[]>('/ai/tts/voices');
    return result;
  },

  synthesize: (data: { text: string; voice?: string; speed?: number; output_format?: string }) =>
    requestBlob('/ai/tts', { method: 'POST', data }),
};
