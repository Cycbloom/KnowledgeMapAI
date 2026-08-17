/**
 * TTS 音色清单（Sambert 系列）
 *
 * 权威数据源：路由 /api/ai/tts/voices 与前端音色选择器共用此清单，
 * 禁止在路由内硬编码音色列表。
 */
export interface TtsVoice {
  id: string;
  name: string;
  lang: string;
}

export const TTS_VOICES: readonly TtsVoice[] = [
  { id: 'sambert-zhide-v1', name: '知德 (Male, Chinese)', lang: 'zh' },
  { id: 'sambert-zhichu-v1', name: '知厨 (Male, Chinese)', lang: 'zh' },
  { id: 'sambert-zhiyan-v1', name: '知言 (Female, Chinese)', lang: 'zh' },
  { id: 'sambert-zhixiao-v1', name: '知笑 (Female, Chinese)', lang: 'zh' },
  { id: 'sambert-zhilan-v1', name: '知岚 (Female, Chinese)', lang: 'zh' },
] as const;
