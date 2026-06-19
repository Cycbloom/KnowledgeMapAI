import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

interface TestConnectionResult {
  connected: boolean;
  error?: string;
}

export class AIConfigRouteService {
  async testDatabaseConnection(
    admin: SupabaseClient,
  ): Promise<TestConnectionResult> {
    try {
      const { error } = await admin
        .from('app_settings')
        .select('key')
        .limit(1);

      if (error) {
        return { connected: false, error: error.message };
      }
      return { connected: true };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      logger.error('Database connection test failed:', error);
      return { connected: false, error: err };
    }
  }

  async testDatabaseConnectionWithConfig(
    admin: SupabaseClient,
  ): Promise<TestConnectionResult> {
    try {
      const { error } = await admin
        .from('app_settings')
        .select('key')
        .limit(1);

      if (error) {
        return { connected: false, error: error.message };
      }
      return { connected: true };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      logger.error('Database connection test with config failed:', error);
      return { connected: false, error: err };
    }
  }
}

export const aiConfigRouteService = new AIConfigRouteService();
