import type { TTSVoice } from '@shared/types';

export interface ITtsApi {
  health(): Promise<unknown>;

  voices(): Promise<TTSVoice[]>;

  synthesize(data: {
    text: string;
    voice?: string;
    speed?: number;
    output_format?: string;
  }): Promise<Blob>;
}
