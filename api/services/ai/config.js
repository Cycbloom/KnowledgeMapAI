import dotenv from 'dotenv';
import { settingsService } from '../core/settingsService.js';
import { logger } from '../../utils/logger.js';
dotenv.config();
// Fallback env configs
const getEnvConfig = (provider) => {
    switch (provider) {
        case 'deepseek':
            return {
                apiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '',
                baseURL: 'https://api.deepseek.com',
                model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            };
        case 'volcengine':
            return {
                apiKey: process.env.VOLCENGINE_API_KEY || '',
                baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
                model: process.env.VOLCENGINE_MODEL || 'doubao-seed-1-8-251228',
                embeddingModel: process.env.VOLCENGINE_EMBEDDING_MODEL || 'doubao-embedding-vision-251215',
            };
        case 'aliyun':
            return {
                apiKey: process.env.ALIYUN_API_KEY || '',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                model: process.env.ALIYUN_MODEL || 'qwen-long-latest',
            };
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
};
export const getProviderConfig = async (provider) => {
    try {
        const allConfigs = await settingsService.getSetting('ai_provider_config');
        if (allConfigs && allConfigs[provider]) {
            const dbConfig = allConfigs[provider];
            // Merge strategy: DB Config > Env Var
            return {
                apiKey: dbConfig.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`] || '',
                baseURL: dbConfig.baseURL,
                model: dbConfig.model,
                embeddingModel: dbConfig.embeddingModel
            };
        }
    }
    catch (error) {
        logger.error('Failed to load settings from DB, falling back to env', error);
    }
    return getEnvConfig(provider);
};
export const getDefaultProvider = async () => {
    try {
        const sysConfig = await settingsService.getSetting('system_config');
        if (sysConfig?.default_provider) {
            return sysConfig.default_provider;
        }
    }
    catch (e) {
        // ignore
    }
    return process.env.AI_DEFAULT_PROVIDER || 'deepseek';
};
export const getProviderForTask = async (task = 'text') => {
    try {
        const sysConfig = await settingsService.getSetting('system_config');
        if (sysConfig && sysConfig.task_mapping && sysConfig.task_mapping[task]) {
            return sysConfig.task_mapping[task];
        }
    }
    catch (e) {
        // ignore
    }
    // Default provider mapping fallback
    const envMap = {
        'text': 'deepseek',
        'embedding': 'volcengine',
        'reasoning': 'aliyun',
        'tts': 'aliyun'
    };
    return envMap[task] || await getDefaultProvider();
};
//# sourceMappingURL=config.js.map