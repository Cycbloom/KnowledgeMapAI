import { request, requestUpload } from './client';
import type { STTResult } from '@shared/types';

export const sttApi = {
  /** 语音转文字：multipart 上传统一走 requestUpload（鉴权/CSRF/移动端头由拦截器补齐） */
  transcribe: (file: File, options?: { language?: string }): Promise<STTResult> => {
    const formData = new FormData();
    formData.append('audio', file);
    if (options?.language) {
      formData.append('language', options.language);
    }
    return requestUpload<STTResult>('/ai/stt', formData);
  },

  health: () => request<Record<string, unknown>>('/ai/stt/health'),
};
