import type { AIProvider, AIProviderType } from '@shared/types';
import { DeepseekProvider } from './providers/deepseek';
import { VolcengineProvider } from './providers/volcengine';
import { AliyunProvider } from './providers/aliyun';
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
    default:
      throw new Error(`Unsupported AI Provider: ${targetType}`);
  }
};

export const getAIProviderForTask = async (
  task: 'text' | 'embedding' | 'reasoning' | 'tts' = 'text', 
  providerOverride?: string, 
  modelOverride?: string
): Promise<AIProvider> => {
    const defaultProviderType = await getProviderForTask(task);
    const providerType = (providerOverride as AIProviderType) || defaultProviderType;
    
    const provider = await getAIProvider(providerType);
    
    if (modelOverride) {
      return {
        ...provider,
        model: modelOverride
      };
    }
    
    return provider;
};
