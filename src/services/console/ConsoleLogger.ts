import type { CommandResult, CommandPermission } from './types';
import { logger } from '@/utils/logger';

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  command: string;
  permission: CommandPermission;
  result: CommandResult;
  userId: string;
  duration?: number;
}

export interface ConsoleLogQuery {
  command?: string;
  userId?: string;
  success?: boolean;
  permission?: CommandPermission;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

const STORAGE_KEY = 'knowledgeMap_consoleLogs';
const MAX_LOG_ENTRIES = 500;

function loadLogs(): ConsoleLogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    // JSON.parse 容错：localStorage 数据损坏时返回空数组
    return [];
  }
}

function saveLogs(logs: ConsoleLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOG_ENTRIES)));
  } catch {
     
    logger.error('Failed to save console logs');
  }
}

class ConsoleLogger {
  private logs: ConsoleLogEntry[] = [];

  constructor() {
    this.logs = loadLogs();
  }

  log(
    command: string,
    permission: CommandPermission,
    result: CommandResult,
    userId: string,
    duration?: number
  ): ConsoleLogEntry {
    const entry: ConsoleLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      command,
      permission,
      result,
      userId,
      duration,
    };

    this.logs.unshift(entry);

    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(0, MAX_LOG_ENTRIES);
    }

    saveLogs(this.logs);

    return entry;
  }

  query(query: ConsoleLogQuery): ConsoleLogEntry[] {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;

    const searchCmd = query.command ? query.command.toLowerCase() : undefined;
    const hasSuccess = query.success !== undefined;
    const startDate = query.startDate;
    const endDate = query.endDate;

    // 合并多个 filter 链为单趟遍历，消除多次整数组扫描与中间数组分配
    const filtered: ConsoleLogEntry[] = [];
    for (const log of this.logs) {
      if (searchCmd !== undefined && !log.command.toLowerCase().includes(searchCmd)) continue;
      if (query.userId && log.userId !== query.userId) continue;
      if (hasSuccess && log.result.success !== query.success) continue;
      if (query.permission && log.permission !== query.permission) continue;
      if (startDate && log.timestamp < startDate) continue;
      if (endDate && log.timestamp > endDate) continue;
      filtered.push(log);
    }

    return filtered.slice(offset, offset + limit);
  }

  getRecent(limit: number = 10): ConsoleLogEntry[] {
    return this.logs.slice(0, limit);
  }

  getByCommand(command: string, limit: number = 10): ConsoleLogEntry[] {
    const searchCmd = command.toLowerCase();
    return this.logs
      .filter((log) => log.command.toLowerCase().includes(searchCmd))
      .slice(0, limit);
  }

  clear(): void {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  count(): number {
    return this.logs.length;
  }

  getStats(): {
    total: number;
    successful: number;
    failed: number;
    byPermission: Record<CommandPermission, number>;
  } {
    const stats = {
      total: this.logs.length,
      successful: 0,
      failed: 0,
      byPermission: {
        safe: 0,
        warning: 0,
        danger: 0,
      } as Record<CommandPermission, number>,
    };

    for (const log of this.logs) {
      if (log.result.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }
      stats.byPermission[log.permission]++;
    }

    return stats;
  }
}

export const consoleLogger = new ConsoleLogger();
