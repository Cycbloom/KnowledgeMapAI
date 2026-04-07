import type { Command, CommandResult, ParsedArgs, CommandContext, CommandHistoryItem } from '../types';
import { commandRegistry } from '../CommandRegistry';

const VERSION = '1.0.0';
const APP_NAME = 'KnowledgeMap 控制台';

interface HistoryStore {
  items: CommandHistoryItem[];
  maxItems: number;
}

const historyStore: HistoryStore = {
  items: [],
  maxItems: 100,
};

const handleHelp = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const commandName = args.positional[0] || (args.options.command as string);

  if (commandName) {
    const help = commandRegistry.getHelp(commandName);
    if (help) {
      return {
        success: true,
        data: { help },
        message: help,
      };
    }
    return {
      success: false,
      error: `未找到命令 "${commandName}"`,
    };
  }

  const commands = commandRegistry.getAll();
  const commandList = commands.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    usage: cmd.usage,
    permission: cmd.permission,
  }));

  const permissionBadge = (perm: string): string => {
    switch (perm) {
      case 'safe': return '🟢';
      case 'warning': return '🟡';
      case 'danger': return '🔴';
      default: return '⚪';
    }
  };

  let helpText = `📖 ${APP_NAME}\n\n`;
  helpText += `┌────────────────────┬──────────────────────────────┬─────┐\n`;
  helpText += `│ 命令               │ 描述                          │ 级别│\n`;
  helpText += `├────────────────────┼──────────────────────────────┼─────┤\n`;

  for (const cmd of commands) {
    const nameCol = cmd.name.padEnd(20);
    const descCol = (cmd.description || '').padEnd(30);
    helpText += `│ ${nameCol} │ ${descCol} │ ${permissionBadge(cmd.permission)}   │\n`;

    if (cmd.subcommands && cmd.subcommands.length > 0) {
      for (const sub of cmd.subcommands) {
        const fullName = `${cmd.name} ${sub.name}`;
        const subName = ('  └ ' + fullName).padEnd(20);
        const subDesc = (sub.description || '').padEnd(30);
        helpText += `│ ${subName} │ ${subDesc} │ ${permissionBadge(sub.permission || cmd.permission)}   │\n`;
      }
    }
  }

  helpText += `└────────────────────┴──────────────────────────────┴─────┘\n\n`;
  helpText += `使用 help <命令> 查看详细帮助\n\n`;
  helpText += `权限级别: 🟢安全  🟡警告  🔴危险`;

  return {
    success: true,
    data: {
      commands: commandList,
      helpText,
    },
    message: helpText,
  };
};

const handleHistory = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const shouldClear = args.options.clear as boolean;

  if (shouldClear) {
    historyStore.items = [];
    return {
      success: true,
      message: '命令历史已清除',
    };
  }

  const historyList = historyStore.items.map((item, index) => ({
    index: index + 1,
    command: item.command,
    timestamp: new Date(item.timestamp).toISOString(),
    success: item.result?.success ?? false,
  }));

  let historyText = '📜 命令历史\n\n';

  if (historyList.length === 0) {
    historyText += '暂无命令历史记录';
  } else {
    historyText += `┌────┬───────────────────────────────┬───────────┬──────┐\n`;
    historyText += `│ #  │ 命令                          │ 时间      │ 状态  │\n`;
    historyText += `├────┼───────────────────────────────┼───────────┼──────┤\n`;

    for (const item of historyList) {
      const status = item.success ? '✅' : '❌';
      const timeStr = new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const idx = String(item.index).padEnd(2);
      const cmd = item.command.padEnd(31);
      const time = timeStr.padEnd(9);
      historyText += `│ ${idx} │ ${cmd} │ ${time} │ ${status}   │\n`;
    }

    historyText += `└────┴───────────────────────────────┴───────────┴──────┘\n\n`;
    historyText += `共 ${historyList.length} 条记录  ·  使用 --clear 清除历史`;
  }

  return {
    success: true,
    data: {
      items: historyList,
      total: historyList.length,
    },
    message: historyText,
  };
};

const handleClear = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  return {
    success: true,
    data: { clear: true },
    message: 'CLEAR_SCREEN',
  };
};

const handleVersion = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const versionInfo = {
    name: APP_NAME,
    version: VERSION,
    buildDate: new Date().toISOString().split('T')[0],
    node: typeof process !== 'undefined' ? process.version : 'browser',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
  };

  let versionText = `📦 ${APP_NAME}\n\n`;
  versionText += `┌──────────────┬─────────────────────┐\n`;
  versionText += `│ 属性          │ 值                   │\n`;
  versionText += `├──────────────┼─────────────────────┤\n`;
  versionText += `│ 版本          │ v${VERSION.padEnd(19)}│\n`;
  versionText += `│ 构建日期      │ ${versionInfo.buildDate.padEnd(13)}│\n`;
  versionText += `│ 平台          │ ${versionInfo.platform.padEnd(13)}│\n`;
  versionText += `└──────────────┴─────────────────────┘`;

  return {
    success: true,
    data: versionInfo,
    message: versionText,
  };
};

const handleHome = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  if (typeof window !== 'undefined') {
    window.location.href = '/';
    return {
      success: true,
      message: '正在跳转到首页...',
    };
  }
  return {
    success: false,
    error: '无法在当前环境执行跳转',
  };
};

export const helpCommand: Command = {
  name: 'help',
  description: '显示帮助信息',
  usage: 'help [命令]',
  aliases: ['h', '?', '帮助'],
  options: [
    {
      name: 'command',
      alias: 'c',
      type: 'string',
      description: '要查看帮助的命令名称',
      required: false,
    },
  ],
  permission: 'safe',
  handler: handleHelp,
};

export const historyCommand: Command = {
  name: 'history',
  description: '显示或清除命令历史',
  usage: 'history [--clear]',
  aliases: ['历史'],
  options: [
    {
      name: 'clear',
      alias: 'c',
      type: 'boolean',
      description: '清除命令历史',
      required: false,
    },
  ],
  permission: 'safe',
  handler: handleHistory,
};

export const clearCommand: Command = {
  name: 'clear',
  description: '清空控制台屏幕',
  usage: 'clear',
  aliases: ['cls', '清屏'],
  options: [],
  permission: 'safe',
  handler: handleClear,
};

export const versionCommand: Command = {
  name: 'version',
  description: '显示版本信息',
  usage: 'version',
  aliases: ['v', '-v', '--version', '版本'],
  options: [],
  permission: 'safe',
  handler: handleVersion,
};

export const homeCommand: Command = {
  name: 'home',
  description: '返回首页',
  usage: 'home',
  aliases: ['首页', '主页'],
  options: [],
  permission: 'safe',
  handler: handleHome,
};

export function addToHistory(command: string, result?: CommandResult): void {
  const item: CommandHistoryItem = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    command,
    timestamp: Date.now(),
    result,
  };

  historyStore.items.push(item);

  if (historyStore.items.length > historyStore.maxItems) {
    historyStore.items = historyStore.items.slice(-historyStore.maxItems);
  }
}

export function getHistory(): CommandHistoryItem[] {
  return [...historyStore.items];
}

export const systemCommands = [helpCommand, historyCommand, clearCommand, versionCommand, homeCommand];
