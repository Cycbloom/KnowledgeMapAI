import type { STTResult } from '@shared/types';

export interface ISttApi {
  transcribe(file: File, options?: { language?: string }): Promise<STTResult>;
  health(): Promise<unknown>;
}
