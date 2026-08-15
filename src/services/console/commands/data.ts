import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { dataApi, tasksApi } from '../../api/tasks';
import { graphsApi } from '../../api/graphs';
import { AppError, SharedErrorCodes } from "@/utils/errors";
import i18next from 'i18next';

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: i18next.t('console.commands.common.specifySubcommand', { subcommands: subcommandNames }),
    };
  };
};

const handleExportGraph = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);
  const format = (args.options.format as string) || 'json';
  const outputPath = args.options.output as string | undefined;

  if (!graphId) {
    return { success: false, error: i18next.t('console.commands.data.graphIdRequired') };
  }

  const validFormats = ['json', 'markdown', 'pdf'];
  if (!validFormats.includes(format)) {
    return { success: false, error: i18next.t('console.commands.data.invalidFormat', { formats: validFormats.join(', ') }) };
  }

  try {
    const blob = await dataApi.export(graphId, format as 'json' | 'pdf' | 'markdown');

    const result: {
      graphId: string;
      format: string;
      size: number;
      outputPath?: string;
    } = {
      graphId,
      format,
      size: blob.size,
    };

    if (outputPath) {
      result.outputPath = outputPath;
    }

    return {
      success: true,
      data: result,
      message: i18next.t('console.commands.data.exportSuccess', { graphId, format, size: blob.size }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.data.exportFailed');
    return { success: false, error: message };
  }
};

const handleImportData = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const filePath = args.options.file as string;
  const type = args.options.type as string;

  if (!filePath) {
    return { success: false, error: i18next.t('console.commands.data.filePathRequired') };
  }

  if (!type) {
    return { success: false, error: i18next.t('console.commands.data.importTypeRequired') };
  }

  const validTypes = ['graph', 'nodes', 'backup'];
  if (!validTypes.includes(type)) {
    return { success: false, error: i18next.t('console.commands.data.invalidImportType', { types: validTypes.join(', ') }) };
  }

  try {
    const importData = {
      type,
      filePath,
      timestamp: new Date().toISOString(),
    };

    const result = await dataApi.import(importData);

    return {
      success: true,
      data: result,
      message: i18next.t('console.commands.data.importSuccess', { filePath }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.data.importFailed');
    return { success: false, error: message };
  }
};

const handleBackupCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const tablesStr = args.options.tables as string | undefined;

  const defaultTables = ['graphs', 'nodes', 'edges', 'tasks'];
  let tables = defaultTables;

  if (tablesStr) {
    tables = tablesStr.split(',').map((t) => t.trim());
  }

  try {
    const backupResults: Array<{ table: string; count: number; status: string }> = [];

    for (const table of tables) {
      try {
        let count = 0;

        switch (table) {
          case 'graphs': {
            const graphs = await graphsApi.list();
            count = Array.isArray(graphs) ? graphs.length : 0;
            break;
          }
          case 'tasks': {
            const tasksResult = await tasksApi.list(undefined, 1000, 0);
            count = Array.isArray(tasksResult) ? tasksResult.length : 0;
            break;
          }
          default:
            count = 0;
        }

        backupResults.push({
          table,
          count,
          status: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : i18next.t('console.commands.data.unknownError');
        backupResults.push({
          table,
          count: 0,
          status: i18next.t('console.commands.data.backupTableFailed', { message }),
        });
      }
    }

    // 合并 filter+reduce 为单趟遍历，O(2×n) → O(n)
    let successCount = 0;
    let totalCount = 0;
    for (const r of backupResults) {
      if (r.status === 'success') {
        successCount++;
      }
      totalCount += r.count;
    }

    return {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        tables: backupResults,
        summary: {
          tablesProcessed: backupResults.length,
          successCount,
          totalRecords: totalCount,
        },
      },
      message: i18next.t('console.commands.data.backupSuccess', { success: successCount, total: backupResults.length, count: totalCount }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.data.createBackupFailed');
    return { success: false, error: message };
  }
};

export const exportCommand: Command = {
  name: 'export',
  description: i18next.t('console.commands.data.exportDesc'),
  usage: i18next.t('console.commands.data.exportUsage'),
  options: [
    {
      name: 'graph-id',
      alias: 'g',
      type: 'string',
      description: i18next.t('console.commands.data.graphIdOption'),
      required: false,
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: i18next.t('console.commands.data.formatOption'),
      required: false,
      default: 'json',
    },
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: i18next.t('console.commands.data.outputOption'),
      required: false,
    },
  ],
  permission: 'safe',
  handler: handleExportGraph,
};

export const importCommand: Command = {
  name: 'import',
  description: i18next.t('console.commands.data.importDesc'),
  usage: i18next.t('console.commands.data.importUsage'),
  options: [
    {
      name: 'file',
      alias: 'f',
      type: 'string',
      description: i18next.t('console.commands.data.fileOption'),
      required: true,
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: i18next.t('console.commands.data.importTypeOption'),
      required: true,
    },
  ],
  permission: 'safe',
  handler: handleImportData,
};

export const backupCommand: Command = {
  name: 'backup',
  description: i18next.t('console.commands.data.backupDesc'),
  usage: i18next.t('console.commands.data.backupUsage'),
  options: [],
  permission: 'safe',
  handler: createParentHandler('backup', [
    { name: 'create', description: '', usage: '', options: [], permission: 'warning', handler: handleBackupCreate },
  ]),
  subcommands: [
    {
      name: 'create',
      description: i18next.t('console.commands.data.backupCreateDesc'),
      usage: i18next.t('console.commands.data.backupCreateUsage'),
      options: [
        {
          name: 'tables',
          alias: 't',
          type: 'string',
          description: i18next.t('console.commands.data.tablesOption'),
          required: false,
        },
      ],
      permission: 'warning',
      handler: handleBackupCreate,
    },
  ],
};

const handleReset = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const type = (args.options['type'] as string) || 'all';
  const isDryRun = args.options['dry-run'] as boolean;

  const validTypes = ['all', 'graphs', 'tasks', 'study'];
  if (!validTypes.includes(type)) {
    return { success: false, error: i18next.t('console.commands.data.invalidDataType', { types: validTypes.join(', ') }) };
  }

  try {
    const { getApiUrl } = await import('../../../services/api/client');
    const { useStore } = await import('../../../store/useStore');
    const token = useStore.getState().token;
    const apiUrl = await getApiUrl();

    const callResetApi = async (dryRun: boolean, confirm: boolean = false) => {
      const response = await fetch(`${apiUrl}/data/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dry_run: dryRun, confirm, types: [type] }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          useStore.getState().setUser(null, null);
        }
        const errorText = await response.text();
        throw new AppError(errorText || i18next.t('console.commands.data.resetFailed'), SharedErrorCodes.SYSTEM_INTERNAL_ERROR, 500);
      }

      return response.json();
    };

    if (isDryRun) {
      const result = await callResetApi(true);
      const tables = result.summary?.tables || [];
      const totalRecords = tables.reduce((sum: number, t: { count: number }) => sum + (t.count || 0), 0);

      const tableRows = tables.map((t: { table: string; count: number }) => {
        const countStr = String(t.count || 0).padStart(8);
        return `  │ ${t.table.padEnd(20)} │ ${countStr} │ ${i18next.t('console.commands.data.toDelete')}`;
      }).join('\n');

      const output = [
        i18next.t('console.commands.data.resetPreviewTitle'),
        '',
        i18next.t('console.commands.data.resetPreviewType', { type }),
        i18next.t('console.commands.data.resetPreviewMode'),
        '',
        '  ┌────────────────────┬──────────┬────────────┐',
        `  │ ${i18next.t('console.commands.data.tableName')}               │ ${i18next.t('console.commands.data.recordCount')}   │ ${i18next.t('console.commands.common.tableHeaderStatus')}       │`,
        '  ├────────────────────┼──────────┼────────────┤',
        tableRows || `  │ ${i18next.t('console.commands.data.noData')}            │          │            │`,
        '  └────────────────────┴──────────┴────────────┘',
        '',
        i18next.t('console.commands.data.resetPreviewTotal', { count: totalRecords }),
        '',
        i18next.t('console.commands.data.resetPreviewHint'),
      ].join('\n');

      return {
        success: true,
        message: output,
      };
    }

    const previewResult = await callResetApi(true);
    const previewTables = previewResult.summary?.tables || [];
    const previewTotal = previewTables.reduce((sum: number, t: { count: number }) => sum + (t.count || 0), 0);

    const deleteResult = await callResetApi(false, true);
    const deletedTables = deleteResult.summary?.tables || [];

    try {
      const { queryClient } = await import('../../../main');
      if (type === 'all' || type === 'graphs') {
        queryClient.invalidateQueries({ queryKey: ['graphs'] });
      }
      if (type === 'all') {
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        queryClient.invalidateQueries({ queryKey: ['statistics'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    } catch (_e) {
      // Ignore cache invalidation errors
    }

    const tableRows = deletedTables.map((t: { table: string; count: number; deleted: number }, index: number) => {
      const prevCount = previewTables[index]?.count ?? 0;
      const countStr = String(prevCount).padStart(8);
      const statusStr = (t.deleted ?? 0) > 0 ? i18next.t('console.commands.data.deleted') : i18next.t('console.commands.data.skipped');
      return `  │ ${t.table.padEnd(20)} │ ${countStr} │ ${statusStr}`;
    }).join('\n');

    const output = [
      i18next.t('console.commands.data.resetCompleteTitle'),
      '',
      i18next.t('console.commands.data.resetCompleteType', { type }),
      `  ${i18next.t('console.commands.common.time')}: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '  ┌────────────────────┬──────────┬──────────┐',
      `  │ ${i18next.t('console.commands.data.tableName')}               │ ${i18next.t('console.commands.data.deleteCount')}  │ ${i18next.t('console.commands.common.tableHeaderStatus')}     │`,
      '  ├────────────────────┼──────────┼──────────┤',
      tableRows || `  │ ${i18next.t('console.commands.data.noData')}            │          │          │`,
      '  └────────────────────┴──────────┴──────────┘',
      '',
      i18next.t('console.commands.data.resetCompleteTotal', { count: previewTotal }),
    ].join('\n');

    return {
      success: true,
      message: output,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.data.resetFailed');
    return { success: false, error: message };
  }
};

export const resetCommand: Command = {
  name: 'reset',
  description: i18next.t('console.commands.data.resetDesc'),
  usage: i18next.t('console.commands.data.resetUsage'),
  aliases: ['重置', '清除'],
  permission: 'danger',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: i18next.t('console.commands.data.resetTypeOption'),
      required: false,
      default: 'all'
    },
    {
      name: 'dry-run',
      alias: 'd',
      type: 'boolean',
      description: i18next.t('console.commands.data.dryRunOption'),
      required: false
    }
  ],
  handler: handleReset
};

export const dataCommands = [exportCommand, importCommand, backupCommand, resetCommand];
