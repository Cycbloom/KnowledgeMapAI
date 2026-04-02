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

  let helpText = `${APP_NAME} - 可用命令\n`;
  helpText += '='.repeat(50) + '\n\n';

  for (const cmd of commands) {
    helpText += `  ${cmd.name.padEnd(15)} - ${cmd.description}\n`;

    if (cmd.subcommands && cmd.subcommands.length > 0) {
      for (const sub of cmd.subcommands) {
        helpText += `    ${(cmd.name + ' ' + sub.name).padEnd(13)} - ${sub.description}\n`;
      }
    }
  }

  helpText += '\n使用 help <命令> 查看详细帮助\n';
  helpText += '\n权限级别说明:\n';
  helpText += '  safe    - 安全操作，可直接执行\n';
  helpText += '  warning - 警告操作，需要确认\n';
  helpText += '  danger  - 危险操作，需要输入确认文本\n';

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

  let historyText = '命令历史\n';
  historyText += '='.repeat(50) + '\n';

  if (historyList.length === 0) {
    historyText += '暂无命令历史\n';
  } else {
    for (const item of historyList) {
      const status = item.success ? '✓' : '✗';
      historyText += `  ${status} ${item.index}. ${item.command}\n`;
    }
    historyText += `\n共 ${historyList.length} 条命令\n`;
    historyText += '使用 --clear 清除历史\n';
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

  const versionText = `${APP_NAME} v${VERSION}\n构建日期: ${versionInfo.buildDate}\n平台: ${versionInfo.platform}`;

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
