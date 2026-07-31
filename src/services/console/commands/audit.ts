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

  let output = `${i18n.t('console.commands.audit.auditListTitle')}\n`;
  output += `${'='.repeat(60)  }\n\n`;

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const status = log.result.success ? '✓' : '✗';
    const permBadge = `[${log.permission.toUpperCase().padEnd(7)}]`;
    const duration = log.duration ? ` (${log.duration}ms)` : '';

    output += `${status} ${permBadge} ${log.command}${duration}\n`;
    output += `  ${i18n.t('console.commands.audit.auditTime', { time: date.toLocaleString() })}\n`;
    if (!log.result.success && log.result.error) {
      output += `  ${i18n.t('console.commands.audit.auditError', { error: log.result.error })}\n`;
    }
    output += '\n';
  }

  const stats = consoleLogger.getStats();
  output += `${'-'.repeat(60)  }\n`;
  output += `${i18n.t('console.commands.audit.auditStatsLine', { total: stats.total, success: stats.successful, failed: stats.failed })}\n`;

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
      error: i18n.t('console.commands.audit.commandPatternRequired'),
    };
  }

  const logs = consoleLogger.getByCommand(command, limit);

  if (logs.length === 0) {
    return {
      success: true,
      message: i18n.t('console.commands.audit.auditSearchNoMatch', { command }),
    };
  }

  let output = `${i18n.t('console.commands.audit.auditSearchTitle', { command })}\n`;
  output += `${'='.repeat(60)  }\n\n`;

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const status = log.result.success ? '✓' : '✗';
    const permBadge = `[${log.permission.toUpperCase().padEnd(7)}]`;
    const duration = log.duration ? ` (${log.duration}ms)` : '';

    output += `${status} ${permBadge} ${log.command}${duration}\n`;
    output += `  ${i18n.t('console.commands.audit.auditTime', { time: date.toLocaleString() })}\n`;
    if (!log.result.success && log.result.error) {
      output += `  ${i18n.t('console.commands.audit.auditError', { error: log.result.error })}\n`;
    }
    output += '\n';
  }

  output += `${'-'.repeat(60)  }\n`;
  output += `${i18n.t('console.commands.audit.auditSearchFound', { count: logs.length })}\n`;

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

  let output = `${i18n.t('console.commands.audit.auditStatsTitle')}\n`;
  output += `${'='.repeat(40)  }\n\n`;
  output += `${i18n.t('console.commands.audit.auditStatsTotal', { total: stats.total })}\n`;
  output += `${i18n.t('console.commands.audit.auditStatsSuccess', { count: stats.successful })}\n`;
  output += `${i18n.t('console.commands.audit.auditStatsFailed', { count: stats.failed })}\n\n`;
  output += `${i18n.t('console.commands.audit.auditStatsByPermission')}\n`;
  output += `  ${i18n.t('console.commands.audit.auditStatsSafe', { count: stats.byPermission.safe })}\n`;
  output += `  ${i18n.t('console.commands.audit.auditStatsWarning', { count: stats.byPermission.warning })}\n`;
  output += `  ${i18n.t('console.commands.audit.auditStatsDanger', { count: stats.byPermission.danger })}\n`;

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
    message: i18n.t('console.commands.audit.auditClearSuccess'),
  };
};

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: i18n.t('console.commands.common.specifySubcommand', { subcommands: subcommandNames }),
    };
  };
};

export const auditCommand: Command = {
  name: 'audit',
  description: i18n.t('console.commands.audit.auditDesc'),
  usage: i18n.t('console.commands.audit.auditUsage'),
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
      description: i18n.t('console.commands.audit.auditListDesc'),
      usage: i18n.t('console.commands.audit.auditListUsage'),
      options: [
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: i18n.t('console.commands.audit.auditLimitOption'),
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleAuditList,
    },
    {
      name: 'search',
      description: i18n.t('console.commands.audit.auditSearchDesc'),
      usage: i18n.t('console.commands.audit.auditSearchUsage'),
      options: [
        {
          name: 'command',
          alias: 'c',
          type: 'string',
          description: i18n.t('console.commands.audit.auditCommandOption'),
          required: true,
        },
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: i18n.t('console.commands.audit.auditLimitOption'),
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleAuditSearch,
    },
    {
      name: 'stats',
      description: i18n.t('console.commands.audit.auditStatsDesc'),
      usage: i18n.t('console.commands.audit.auditStatsUsage'),
      options: [],
      permission: 'safe',
      handler: handleAuditStats,
    },
    {
      name: 'clear',
      description: i18n.t('console.commands.audit.auditClearDesc'),
      usage: i18n.t('console.commands.audit.auditClearUsage'),
      options: [],
      permission: 'danger',
      handler: handleAuditClear,
    },
  ],
};

export const auditCommands = [auditCommand];
