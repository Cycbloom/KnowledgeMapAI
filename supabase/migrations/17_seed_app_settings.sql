-- =====================================================
-- Knowledge Map - [Seed: App Settings]
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES
    ('ai_provider_config', '{
        "deepseek": { "enabled": true, "apiKey": "", "baseURL": "https://api.deepseek.com", "model": "deepseek-chat" },
        "volcengine": { "enabled": true, "apiKey": "", "baseURL": "https://ark.cn-beijing.volces.com/api/v3", "model": "doubao-seed-1-8-251228", "embeddingModel": "doubao-embedding-vision-251215" },
        "aliyun": { "enabled": true, "apiKey": "", "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-long-latest" }
    }'::jsonb, 'Configuration for AI Providers'),
    ('system_config', '{
        "default_provider": "deepseek",
        "task_mapping": { "text": "deepseek", "embedding": "volcengine", "reasoning": "aliyun" }
    }'::jsonb, 'Global system settings and defaults')
ON CONFLICT (key) DO NOTHING;
