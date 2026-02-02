import { AIProvider, AIProviderType } from './types.js';
import { DeepseekProvider } from './providers/deepseek.js';
import { VolcengineProvider } from './providers/volcengine.js';
import { AliyunProvider } from './providers/aliyun.js';
import { getDefaultProvider, getProviderForTask } from './config.js';

const providers: Map<AIProviderType, AIProvider> = new Map();

export const getAIProvider = (type?: AIProviderType): AIProvider => {
  const targetType = type || getDefaultProvider();
  
  if (!providers.has(targetType)) {
    switch (targetType) {
      case 'deepseek':
        providers.set(targetType, new DeepseekProvider());
        break;
      case 'volcengine':
        providers.set(targetType, new VolcengineProvider());
        break;
      case 'aliyun':
        providers.set(targetType, new AliyunProvider());
        break;
      default:
        // Fallback or error
        throw new Error(`Unsupported AI Provider: ${targetType}`);
    }
  }
  
  return providers.get(targetType)!;
};

export const getAIProviderForTask = (
  task: 'text' | 'embedding' | 'reasoning' = 'text', 
  providerOverride?: string, 
  modelOverride?: string
): AIProvider => {
    const defaultProviderType = getProviderForTask(task);
    const providerType = (providerOverride as AIProviderType) || defaultProviderType;
    
    const provider = getAIProvider(providerType);
    
    if (modelOverride) {
      return {
        ...provider,
        model: modelOverride
      };
    }
    
    return provider;
};
