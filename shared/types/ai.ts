export type AIProviderType = "deepseek" | "volcengine" | "aliyun" | "openai" | "zhipu" | "moonshot";

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model?: string;
  embeddingModel?: string;
  [key: string]: string | undefined;
}

// --- AI Provider Client response types ---
// These types mirror the OpenAI SDK response shapes, allowing the shared layer
// to be decoupled from the openai package while maintaining type safety.

export interface ChatCompletionMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string | null;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface ChatCompletionChunkDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: ChatCompletionUsage;
}

export interface EmbeddingData {
  embedding: number[];
  index: number;
  object: string;
}

export interface EmbeddingResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Params types for chat completions (index signatures allow arbitrary OpenAI-compatible params)
interface ChatCompletionNonStreamingParams {
  stream?: false;
  [key: string]: unknown;
}

interface ChatCompletionStreamingParams {
  stream: true;
  [key: string]: unknown;
}

export interface ChatCompletions {
  create(params: ChatCompletionNonStreamingParams): Promise<ChatCompletionResponse>;
  create(params: ChatCompletionStreamingParams): AsyncIterable<ChatCompletionChunk>;
}

export interface AIProviderClient {
  chat: {
    completions: ChatCompletions;
  };
  embeddings?: {
    create: (params: { [key: string]: unknown }) => Promise<EmbeddingResponse>;
  };
  baseURL: string;
  apiKey: string;
}

export interface AIProvider {
  client: AIProviderClient;
  model: string;
  embeddingModel?: string;
  providerType: AIProviderType;
  hasKey: boolean;
  createEmbedding?: (text: string) => Promise<number[] | null>;
  synthesizeSpeech?: (
    text: string,
    voice?: string,
    speed?: number,
    format?: string,
  ) => Promise<Buffer>;
  transcribeSpeech?: (
    audioBuffer: Buffer,
    options?: { language?: string; format?: string },
  ) => Promise<{ text: string; language?: string; duration?: number }>;
}

export interface AIActionVariables {
  includeParent?: boolean;
  includeSiblings?: boolean;
  includeChildren?: boolean;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_mode: "show_result" | "update_node" | "spawn_children";
  scope: "system" | "user" | "graph";
  user_id?: string;
  graph_id?: string;
  prompt_template: string;
  variables?: AIActionVariables;
}
