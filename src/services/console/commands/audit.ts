import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { consoleLogger } from '../ConsoleLogger';
import i18n from '../../../i18n';

const handleAuditList = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const limit = (args.options.limit as number) || 10;

  const logs = consoleLogger.getRecent(limit);

  if (logs.length === 0) {
    return {
      success: true,
      message: i18n.t('console.noAuditLogs'),
    };
  }

  let output = '审计日志 - 最近命令\n';
  output += `${'='.repeat(60)  }\n\n`;

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const status = log.result.success ? '✓' : '✗';
    const permBadge = `[${log.permission.toUpperCase().padEnd(7)}]`;
    const duration = log.duration ? ` (${log.duration}ms)` : '';

    output += `${status} ${permBadge} ${log.command}${duration}\n`;
    output += `  时间: ${date.toLocaleString()}\n`;
    if (!log.result.success && log.result.error) {
      output += `  错误: ${log.result.error}\n`;
    }
    output += '\n';
  }

  const stats = consoleLogger.getStats();
  output += `${'-'.repeat(60)  }\n`;
  output += `总计: ${stats.total} | 成功: ${stats.successful} | 失败: ${stats.failed}\n`;

  return {
    success: true,
    data: {
      logs,
      stats,
    },
    message: output,
  };
};

const handleAuditSearch = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const command = args.options.command as string;
  const limit = (args.options.limit as number) || 10;

  if (!command) {
    return {
      success: false,
      error: '命令模式是必需的 (--command)',
    };
  }

  const logs = consoleLogger.getByCommand(command, limit);

  if (logs.length === 0) {
    return {
      success: true,
      message: `未找到匹配 "${command}" 的审计日志`,
    };
  }

  let output = `审计日志 - 搜索结果 "${command}"\n`;
  output += `${'='.repeat(60)  }\n\n`;

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const status = log.result.success ? '✓' : '✗';
    const permBadge = `[${log.permission.toUpperCase().padEnd(7)}]`;
    const duration = log.duration ? ` (${log.duration}ms)` : '';

    output += `${status} ${permBadge} ${log.command}${duration}\n`;
    output += `  时间: ${date.toLocaleString()}\n`;
    if (!log.result.success && log.result.error) {
      output += `  错误: ${log.result.error}\n`;
    }
    output += '\n';
  }

  output += `${'-'.repeat(60)  }\n`;
  output += `找到: ${logs.length} 条记录\n`;

  return {
    success: true,
    data: {
      logs,
      query: command,
    },
    message: output,
  };
};

const handleAuditStats = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const stats = consoleLogger.getStats();

  let output = '审计统计\n';
  output += `${'='.repeat(40)  }\n\n`;
  output += `总命令数: ${stats.total}\n`;
  output += `成功: ${stats.successful}\n`;
  output += `失败: ${stats.failed}\n\n`;
  output += '按权限级别:\n';
  output += `  安全:    ${stats.byPermission.safe}\n`;
  output += `  警告:    ${stats.byPermission.warning}\n`;
  output += `  危险:    ${stats.byPermission.danger}\n`;

  return {
    success: true,
    data: stats,
    message: output,
  };
};

const handleAuditClear = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  consoleLogger.clear();

  return {
    success: true,
    message: '审计日志已清除',
  };
};

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: `请指定子命令。可用子命令: ${subcommandNames}`,
    };
  };
};

export const auditCommand: Command = {
  name: 'audit',
  description: '查看和管理命令执行审计日志',
  usage: 'audit <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('audit', [
    { name: 'list', description: '', usage: '', options: [], permission: 'safe', handler: handleAuditList },
    { name: 'search', description: '', usage: '', options: [], permission: 'safe', handler: handleAuditSearch },
    { name: 'stats', description: '', usage: '', options: [], permission: 'safe', handler: handleAuditStats },
    { name: 'clear', description: '', usage: '', options: [], permission: 'danger', handler: handleAuditClear },
  ]),
  subcommands: [
    {
      name: 'list',
      description: '列出最近的审计日志',
      usage: 'audit list [--limit 10]',
      options: [
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: '显示的日志数量',
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleAuditList,
    },
    {
      name: 'search',
      description: '按命令搜索审计日志',
      usage: 'audit search --command <模式> [--limit 10]',
      options: [
        {
          name: 'command',
          alias: 'c',
          type: 'string',
          description: '要搜索的命令模式',
          required: true,
        },
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: '显示的日志数量',
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleAuditSearch,
    },
    {
      name: 'stats',
      description: '显示审计统计',
      usage: 'audit stats',
      options: [],
      permission: 'safe',
      handler: handleAuditStats,
    },
    {
      name: 'clear',
      description: '清除所有审计日志（危险操作）',
      usage: 'audit clear',
      options: [],
      permission: 'danger',
      handler: handleAuditClear,
    },
  ],
};

export const auditCommands = [auditCommand];
