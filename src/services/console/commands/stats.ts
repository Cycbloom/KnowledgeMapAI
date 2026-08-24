import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { dashboardApi } from '../../api/study';
import i18next from 'i18next';

const handleStats = async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  try {
    const summary = await dashboardApi.getTodaySummary();
    const rows: Array<[string, number]> = [
      [i18next.t('console.commands.stats.inboxPending'), summary.inboxCount],
      [i18next.t('console.commands.stats.dueCardsToday'), summary.dueCards],
      [i18next.t('console.commands.stats.dueTasksToday'), summary.dueTasks],
    ];

    let text = `${i18next.t('console.commands.stats.title')}\n\n`;
    text += `┌────────────────────────┬──────────┐\n`;
    text += `│ ${i18next.t('console.commands.stats.headerItem').padEnd(24)} │ ${i18next.t('console.commands.stats.headerCount').padEnd(8)} │\n`;
    text += `├────────────────────────┼──────────┤\n`;

    for (const [label, count] of rows) {
      text += `│ ${label.padEnd(24)} │ ${String(count).padEnd(8)} │\n`;
    }

    text += `└────────────────────────┴──────────┘`;

    return {
      success: true,
      data: summary,
      message: text,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: i18next.t('console.commands.stats.failed', { message: detail }),
    };
  }
};

export const statsCommand: Command = {
  name: 'stats',
  description: i18next.t('console.commands.stats.statsDesc'),
  usage: i18next.t('console.commands.stats.statsUsage'),
  aliases: ['today', '今日'],
  options: [],
  permission: 'safe',
  handler: handleStats,
};

export const statsCommands = [statsCommand];
