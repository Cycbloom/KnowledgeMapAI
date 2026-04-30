import { logger } from './logger';

interface EnvConfig {
  required: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url';
  default?: string | number | boolean;
  validate?: (value: string) => boolean;
  description?: string;
}

const ENV_SCHEMA: Record<string, EnvConfig> = {
  NODE_ENV: {
    required: false,
    type: 'string',
    default: 'development',
    validate: (v) => ['development', 'production', 'test'].includes(v),
    description: 'Application environment',
  },
  PORT: {
    required: false,
    type: 'number',
    default: 3001,
    description: 'Server port',
  },
  FRONTEND_URL: {
    required: false,
    type: 'url',
    description: 'Frontend URL for CORS',
  },
  VITE_SUPABASE_URL: {
    required: true,
    type: 'url',
    description: 'Supabase project URL (used by frontend)',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    type: 'string',
    description: 'Supabase service role key',
  },
  DEEPSEEK_API_KEY: {
    required: false,
    type: 'string',
    description: 'DeepSeek API key',
  },
  ALIYUN_API_KEY: {
    required: false,
    type: 'string',
    description: 'Aliyun API key',
  },
  VOLCENGINE_API_KEY: {
    required: false,
    type: 'string',
    description: 'Volcengine API key',
  },
  TEST_USER_EMAIL: {
    required: false,
    type: 'string',
    description: 'Test user email for E2E testing',
  },
  TEST_USER_PASSWORD: {
    required: false,
    type: 'string',
    description: 'Test user password for E2E testing',
  },
  DISABLE_RATE_LIMIT: {
    required: false,
    type: 'boolean',
    default: false,
    description: 'Disable rate limiting (for testing)',
  },
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string | number | boolean>;
}

export const validateEnv = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, string | number | boolean> = {};

  for (const [key, schema] of Object.entries(ENV_SCHEMA)) {
    const value = process.env[key];

    if (value === undefined || value === '') {
      if (schema.required) {
        errors.push(`Missing required environment variable: ${key}`);
        continue;
      } else if (schema.default !== undefined) {
        config[key] = schema.default;
        continue;
      } else {
        continue;
      }
    }

    if (schema.type === 'number') {
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        errors.push(`Invalid number for ${key}: ${value}`);
        continue;
      }
      config[key] = num;
    } else if (schema.type === 'boolean') {
      config[key] = value === 'true' || value === '1';
    } else if (schema.type === 'url') {
      try {
        new URL(value);
        config[key] = value;
      } catch {
        errors.push(`Invalid URL for ${key}: ${value}`);
        continue;
      }
    } else {
      config[key] = value;
    }

    if (schema.validate && !schema.validate(value)) {
      warnings.push(`Validation warning for ${key}: value may not meet requirements`);
    }
  }

  const hasApiKey = 
    process.env.DEEPSEEK_API_KEY ||
    process.env.ALIYUN_API_KEY ||
    process.env.VOLCENGINE_API_KEY;

  if (!hasApiKey) {
    warnings.push('No AI API key configured. AI features will be limited.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config,
  };
};

export const getEnvConfig = (): Record<string, string | number | boolean> => {
  const result = validateEnv();
  return result.config;
};

export const checkEnvOnStartup = (): void => {
  logger.info('Validating environment configuration...');
  
  const result = validateEnv();

  if (result.errors.length > 0) {
    logger.error('Environment validation failed:');
    result.errors.forEach(error => logger.error(`  - ${error}`));
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  if (result.warnings.length > 0) {
    logger.warn('Environment warnings:');
    result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  if (result.valid) {
    logger.info('Environment configuration is valid');
  }
};

export const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const getOptionalEnv = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

export const getNumericEnv = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
};

export const getBooleanEnv = (key: string, defaultValue: boolean = false): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
};
