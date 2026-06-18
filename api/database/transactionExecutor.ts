import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

class TransactionExecutor {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (!this.pool) {
      const url = process.env.DATABASE_URL;
      if (!url) {
        throw new Error(
          'DATABASE_URL is not configured. Set the DATABASE_URL environment variable to enable transaction support.',
        );
      }

      const poolConfig: PoolConfig = {
        connectionString: url,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };

      this.pool = new Pool(poolConfig);

      this.pool.on('error', (err) => {
        logger.error('Unexpected pool error:', err);
      });

      logger.info('TransactionExecutor: pg Pool initialized');
    }

    return this.pool;
  }

  isAvailable(): boolean {
    return typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
  }

  async executeInTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async query(text: string, params?: unknown[]): Promise<unknown> {
    const pool = this.getPool();
    const result = await pool.query(text, params);
    return result;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('TransactionExecutor: pg Pool closed');
    }
  }
}

export const transactionExecutor = new TransactionExecutor();
