import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

interface DatabaseHealthResult {
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  message?: string;
}

export class SystemMonitorService {
  async checkDatabaseHealth(
    admin: SupabaseClient,
  ): Promise<DatabaseHealthResult> {
    const start = Date.now();
    try {
      const { error } = await admin
        .from('knowledge_graphs')
        .select('id')
        .limit(1);

      const latency = Date.now() - start;

      if (error) {
        return {
          status: 'down',
          latency,
          message: error.message,
        };
      }

      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'down',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const systemMonitorService = new SystemMonitorService();
