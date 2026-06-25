import type { AIProvider, AIProviderType } from '@shared/types';
import { DeepseekProvider } from './providers/deepseek';
import { VolcengineProvider } from './providers/volcengine';
import { AliyunProvider } from './providers/aliyun';
import { OpenAIProvider } from './providers/openai';
import { ZhipuProvider } from './providers/zhipu';
import { MoonshotProvider } from './providers/moonshot';
import { getDefaultProvider, getProviderForTask, getProviderConfig } from './config';

export const getAIProvider = async (type?: AIProviderType): Promise<AIProvider> => {
  const targetType = type || await getDefaultProvider();
  const config = await getProviderConfig(targetType);
  
  switch (targetType) {
    case 'deepseek':
      return new DeepseekProvider(config);
    case 'volcengine':
      return new VolcengineProvider(config);
    case 'aliyun':
      return new AliyunProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'zhipu':
      return new ZhipuProvider(config);
    case 'moonshot':
      return new MoonshotProvider(config);
    default:
      throw new Error(`Unsupported AI Provider: ${targetType}`);
  }
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
