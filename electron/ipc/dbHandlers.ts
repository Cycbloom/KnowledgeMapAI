import { ipcMain } from 'electron';
import { DatabaseManager } from '../db/database';

export interface IpcDbRequest {
  resource: string;  // table name
  method: string;    // 'findAll' | 'findById' | 'create' | 'update' | 'delete' | 'softDelete' | 'count' | 'getPendingPush'
  params: Record<string, unknown>;
}

export interface IpcDbResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IpcDbBatchRequest {
  operations: IpcDbRequest[];
}

export function registerDbIpcHandlers(dbManager: DatabaseManager): void {
  // db:query - Single database operation
  ipcMain.handle('db:query', async (_event, request: IpcDbRequest): Promise<IpcDbResponse> => {
    try {
      if (!dbManager.isReady()) {
        return { success: false, error: 'Database not initialized' };
      }

      const { resource, method, params } = request;
      let result: unknown;

      switch (method) {
        case 'findAll':
          result = dbManager.findAll(resource, params.filters as Record<string, unknown> | undefined);
          break;
        case 'findById':
          result = dbManager.findById(resource, params.id as string);
          break;
        case 'create':
          result = dbManager.create(resource, params.data as Record<string, unknown>);
          break;
        case 'update':
          result = dbManager.update(resource, params.id as string, params.data as Record<string, unknown>);
          break;
        case 'delete':
          result = dbManager.delete(resource, params.id as string);
          break;
        case 'softDelete':
          result = dbManager.softDelete(resource, params.id as string);
          break;
        case 'count':
          // Simple count query
          result = dbManager.findAll(resource).length;
          break;
        case 'getPendingPush':
          result = dbManager.getPendingPush(resource);
          break;
        default:
          return { success: false, error: `Unknown method: ${method}` };
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // db:batch - Multiple operations in a transaction
  ipcMain.handle('db:batch', async (_event, request: IpcDbBatchRequest): Promise<IpcDbResponse> => {
    try {
      if (!dbManager.isReady()) {
        return { success: false, error: 'Database not initialized' };
      }

      const results: unknown[] = [];
      // Execute each operation
      for (const op of request.operations) {
        const { resource, method, params } = op;
        let result: unknown;

        switch (method) {
          case 'create':
            result = dbManager.create(resource, params.data as Record<string, unknown>);
            break;
          case 'update':
            result = dbManager.update(resource, params.id as string, params.data as Record<string, unknown>);
            break;
          case 'delete':
            result = dbManager.delete(resource, params.id as string);
            break;
          case 'softDelete':
            result = dbManager.softDelete(resource, params.id as string);
            break;
          default:
            result = { error: `Unknown method: ${method}` };
        }
        results.push(result);
      }

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // db:getStatus - Get database status
  ipcMain.handle('db:getStatus', async (): Promise<IpcDbResponse> => {
    try {
      if (!dbManager.isReady()) {
        return { success: false, error: 'Database not initialized' };
      }

      const pendingCounts = dbManager.countPendingPush();
      const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);

      return {
        success: true,
        data: {
          isReady: true,
          pendingPushCounts: pendingCounts,
          totalPendingPush: totalPending,
        }
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
