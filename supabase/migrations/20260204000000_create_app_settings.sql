-- Create app_settings table for global system configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access for authenticated users" ON app_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all access for authenticated users" ON app_settings
    FOR ALL TO authenticated USING (true);

-- Insert default AI provider config structure (template)
INSERT INTO app_settings (key, value, description)
VALUES 
    ('ai_provider_config', '{
        "deepseek": { 
            "enabled": true,
            "apiKey": "", 
            "baseURL": "https://api.deepseek.com", 
            "model": "deepseek-chat" 
        },
        "volcengine": { 
            "enabled": true,
            "apiKey": "", 
            "baseURL": "https://ark.cn-beijing.volces.com/api/v3", 
            "model": "doubao-seed-1-8-251228",
            "embeddingModel": "doubao-embedding-vision-251215"
        },
        "aliyun": { 
            "enabled": true,
            "apiKey": "", 
            "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1", 
            "model": "qwen-long-latest" 
        }
    }'::jsonb, 'Configuration for AI Providers')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES 
    ('system_config', '{
        "default_provider": "deepseek",
        "task_mapping": {
            "text": "deepseek",
            "embedding": "volcengine",
            "reasoning": "aliyun"
        }
    }'::jsonb, 'Global system settings and defaults')
ON CONFLICT (key) DO NOTHING;
