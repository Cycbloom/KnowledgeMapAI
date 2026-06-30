import type { AIProvider, AIProviderType } from '@shared/types';
import { providerRegistry } from './providerRegistry';
import { getDefaultProvider, getProviderForTask, getProviderConfig } from './config';

// Ensure all providers are imported so they register themselves
import './providers/deepseek';
import './providers/volcengine';
import './providers/aliyun';
import './providers/openai';
import './providers/zhipu';
import './providers/moonshot';

// 单例缓存：避免每次调用 getAIProvider 都重新构造 provider 实例（构造函数内会 new OpenAI HTTP client）
const providerCache = new Map<AIProviderType, AIProvider>();

export const getAIProvider = async (type?: AIProviderType): Promise<AIProvider> => {
  const targetType = type || await getDefaultProvider();

  const cached = providerCache.get(targetType);
  if (cached) {
    return cached;
  }

  const config = await getProviderConfig(targetType);

  const provider = providerRegistry.create(targetType, config);

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
