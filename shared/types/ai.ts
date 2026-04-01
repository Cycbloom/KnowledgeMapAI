import type OpenAI from 'openai';

export type AIProviderType = 'deepseek' | 'volcengine' | 'aliyun';

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  embeddingModel?: string;
}

export interface AIProvider {
  client: OpenAI;
  model: string;
  embeddingModel?: string;
  providerType: AIProviderType;
  hasKey: boolean;
  createEmbedding?: (text: string) => Promise<number[] | null>;
  synthesizeSpeech?: (text: string, voice?: string, speed?: number, format?: string) => Promise<Buffer>;
}

export interface AIActionVariables {
  includeParent?: boolean;
  includeSiblings?: boolean;
  includeChildren?: boolean;
}

export type AnalysisMode = 'quick' | 'deep' | 'custom';

export interface AnalysisModeOption {
  mode: AnalysisMode;
  label: string;
  description: string;
  iconName: string;
  color: string;
  bgColor: string;
  hoverBgColor: string;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_mode: 'show_result' | 'update_node' | 'spawn_children';
  scope: 'system' | 'user' | 'graph';
  user_id?: string;
  graph_id?: string;
  prompt_template: string;
  variables?: AIActionVariables;
}
