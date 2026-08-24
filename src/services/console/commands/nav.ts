import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import i18next from 'i18next';

interface NavTarget {
  name: string;
  path: string;
  labelKey: string;
  aliases: string[];
}

const NAV_TARGETS: NavTarget[] = [
  { name: 'home', path: '/', labelKey: 'layout.myGraphs', aliases: ['dashboard', 'graphs', '首页'] },
  { name: 'graph-map', path: '/graph-map', labelKey: 'layout.graphMap', aliases: ['map', '图谱地图'] },
  { name: 'study', path: '/study', labelKey: 'layout.studyCenter', aliases: ['学习中心'] },
  { name: 'learning', path: '/learning', labelKey: 'layout.breadcrumb.learningMode', aliases: ['学习模式'] },
  { name: 'learning-paths', path: '/learning-paths', labelKey: 'layout.learningPaths', aliases: ['paths', '学习路径'] },
  { name: 'notes', path: '/notes', labelKey: 'layout.notes', aliases: ['笔记'] },
  { name: 'templates', path: '/templates', labelKey: 'layout.templates', aliases: ['模板'] },
  { name: 'tasks', path: '/tasks', labelKey: 'layout.tasks', aliases: ['任务'] },
  { name: 'scheduler', path: '/scheduler', labelKey: 'layout.scheduler', aliases: ['调度'] },
  { name: 'calendar', path: '/calendar', labelKey: 'layout.calendar', aliases: ['日历'] },
  { name: 'statistics', path: '/statistics', labelKey: 'layout.statistics', aliases: ['统计'] },
  { name: 'achievements', path: '/achievements', labelKey: 'layout.achievements', aliases: ['成就'] },
  { name: 'profile', path: '/profile', labelKey: 'layout.profile', aliases: ['个人设置'] },
  { name: 'settings', path: '/settings', labelKey: 'layout.breadcrumb.settings', aliases: ['设置'] },
  { name: 'trash', path: '/trash', labelKey: 'layout.trash', aliases: ['回收站'] },
];

export function findNavTarget(query: string): NavTarget | undefined {
  const normalized = query.trim().toLowerCase().replace(/^\/+/, '');
  if (!normalized) return undefined;

  return NAV_TARGETS.find(
    (target) =>
      target.name === normalized ||
      target.aliases.some((alias) => alias.toLowerCase() === normalized),
  );
}

const listTargets = (): string => {
  let text = `${i18next.t('console.commands.nav.listTitle')}\n\n`;
  text += `┌──────────────────┬──────────────────────┬──────────────────────┐\n`;
  text += `│ ${i18next.t('console.commands.nav.headerTarget').padEnd(16)} │ ${i18next.t('console.commands.nav.headerPath').padEnd(20)} │ ${i18next.t('console.commands.nav.headerLabel').padEnd(20)} │\n`;
  text += `├──────────────────┼──────────────────────┼──────────────────────┤\n`;

  for (const target of NAV_TARGETS) {
    const nameCol = target.name.padEnd(18);
    const pathCol = target.path.padEnd(22);
    const label = i18next.t(target.labelKey as never) as string;
    text += `│ ${nameCol} │ ${pathCol} │ ${label.padEnd(20)} │\n`;
  }

  text += `└──────────────────┴──────────────────────┴──────────────────────┘`;
  return text;
};

const handleNav = async (args: ParsedArgs, context: CommandContext): Promise<CommandResult> => {
  const raw = (args.positional[0] || '').trim();

  if (!raw) {
    return {
      success: true,
      data: { targets: NAV_TARGETS.map(({ name, path }) => ({ name, path })) },
      message: listTargets(),
    };
  }

  if (!context.navigate) {
    return {
      success: false,
      error: i18next.t('console.commands.nav.noNavigator'),
    };
  }

  if (raw.startsWith('/') && !findNavTarget(raw)) {
    context.navigate(raw);
    return {
      success: true,
      data: { path: raw },
      message: i18next.t('console.commands.nav.navigating', { target: raw }),
    };
  }

  const target = findNavTarget(raw);
  if (!target) {
    return {
      success: false,
      error: i18next.t('console.commands.nav.unknownTarget', { target: raw }),
    };
  }

  context.navigate(target.path);
  return {
    success: true,
    data: { path: target.path },
    message: i18next.t('console.commands.nav.navigating', {
      target: `${i18next.t(target.labelKey as never) as string} (${target.path})`,
    }),
  };
};

export const navCommand: Command = {
  name: 'nav',
  description: i18next.t('console.commands.nav.navDesc'),
  usage: i18next.t('console.commands.nav.navUsage'),
  aliases: ['goto', '导航'],
  options: [],
  permission: 'safe',
  handler: handleNav,
};

export const navCommands = [navCommand];
