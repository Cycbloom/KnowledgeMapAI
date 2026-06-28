import type { AIProvider, AIProviderType } from '@shared/types';
import { DeepseekProvider } from './providers/deepseek';
import { VolcengineProvider } from './providers/volcengine';
import { AliyunProvider } from './providers/aliyun';
import { OpenAIProvider } from './providers/openai';
import { ZhipuProvider } from './providers/zhipu';
import { MoonshotProvider } from './providers/moonshot';
import { getDefaultProvider, getProviderForTask, getProviderConfig } from './config';

// 单例缓存：避免每次调用 getAIProvider 都重新构造 provider 实例（构造函数内会 new OpenAI HTTP client）
const providerCache = new Map<AIProviderType, AIProvider>();

export const getAIProvider = async (type?: AIProviderType): Promise<AIProvider> => {
  const targetType = type || await getDefaultProvider();

  const cached = providerCache.get(targetType);
  if (cached) {
    return cached;
  }

  const config = await getProviderConfig(targetType);

  let provider: AIProvider;
  switch (targetType) {
    case 'deepseek':
      provider = new DeepseekProvider(config);
      break;
    case 'volcengine':
      provider = new VolcengineProvider(config);
      break;
    case 'aliyun':
      provider = new AliyunProvider(config);
      break;
    case 'openai':
      provider = new OpenAIProvider(config);
      break;
    case 'zhipu':
      provider = new ZhipuProvider(config);
      break;
    case 'moonshot':
      provider = new MoonshotProvider(config);
      break;
    default:
      throw new Error(`Unsupported AI Provider: ${targetType}`);
  }

  providerCache.set(targetType, provider);
  return provider;
};

/**
 * 清除 provider 单例缓存。
 * - 不传 type：清空所有 provider 缓存
 * - 传 type：仅清除指定 type 的缓存
 *
 * 用户更新 API key、baseURL、model 等配置后需调用以重新构造 provider。
 */
export const clearProviderCache = (type?: AIProviderType): void => {
  if (type) {
    providerCache.delete(type);
    return;
  }
  providerCache.clear();
};

export const getAIProviderForTask = async (
  task: 'text' | 'embedding' | 'reasoning' | 'tts' | 'stt' = 'text',
  providerOverride?: string,
  modelOverride?: string
): Promise<AIProvider> => {
    const defaultProviderType = await getProviderForTask(task);

    const providerType = (providerOverride as AIProviderType) || defaultProviderType || await getDefaultProvider();

    const provider = await getAIProvider(providerType);
    
    if (modelOverride) {
      return {
        ...provider,
        model: modelOverride
      };
    }
    
    return provider;
};
