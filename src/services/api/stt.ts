import { getApiUrl } from './client';
import { isCapacitorMobile } from '@/config/mobileApiConfig';
import { useStore } from '@/store/useStore';
import type { STTResult } from '@shared/types';
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const sttApi = {
  transcribe: async (file: File, options?: { language?: string }): Promise<STTResult> => {
    const token = useStore.getState().token;
    const formData = new FormData();
    formData.append('audio', file);
    if (options?.language) {
      formData.append('language', options.language);
    }

    const response = await fetch(`${await getApiUrl()}/ai/stt`, {
      method: 'POST',
      headers: {
        // 移动端标识：后端 CSRF 中间件据此豁免（跨源场景 csrf cookie 无法送达）
        ...(isCapacitorMobile() ? { 'x-mobile-client': 'true' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 401) {
        useStore.getState().setUser(null, null);
      }
      const errorText = await response.text();
      throw new AppError(errorText || 'STT transcription failed', SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
    }

    return response.json();
  },

  health: () => {
    const token = useStore.getState().token;
    return getApiUrl().then((url) =>
      fetch(`${url}/ai/stt/health`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).then((res) => res.json()),
    );
  },
};
