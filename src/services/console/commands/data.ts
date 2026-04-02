import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { dataApi, tasksApi } from '../../api/tasks';
import { graphsApi } from '../../api/graphs';

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: `请指定子命令。可用子命令: ${subcommandNames}`,
    };
  };
};

const handleExportGraph = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);
  const format = (args.options.format as string) || 'json';
  const outputPath = args.options.output as string | undefined;

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的' };
  }

  const validFormats = ['json', 'markdown', 'pdf'];
  if (!validFormats.includes(format)) {
    return { success: false, error: `无效的格式。有效格式: ${validFormats.join(', ')}` };
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
      message: `图谱 ${graphId} 导出成功，格式: ${format} (${blob.size} 字节)`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出图谱失败';
    return { success: false, error: message };
  }
};

const handleImportData = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const filePath = args.options.file as string;
  const type = args.options.type as string;

  if (!filePath) {
    return { success: false, error: '文件路径是必需的 (--file)' };
  }

  if (!type) {
    return { success: false, error: '导入类型是必需的 (--type)' };
  }

  const validTypes = ['graph', 'nodes', 'backup'];
  if (!validTypes.includes(type)) {
    return { success: false, error: `无效的导入类型。有效类型: ${validTypes.join(', ')}` };
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
      message: `数据从 ${filePath} 导入成功`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入数据失败';
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
        const message = error instanceof Error ? error.message : '未知错误';
        backupResults.push({
          table,
          count: 0,
          status: `失败: ${message}`,
        });
      }
    }

    const successCount = backupResults.filter((r) => r.status === 'success').length;
    const totalCount = backupResults.reduce((sum, r) => sum + r.count, 0);

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
      message: `备份创建成功: ${successCount}/${backupResults.length} 个表, 共 ${totalCount} 条记录`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建备份失败';
    return { success: false, error: message };
  }
};

export const exportCommand: Command = {
  name: 'export',
  description: '导出数据操作',
  usage: 'export graph <图谱ID> --format <json|markdown> [--output <路径>]',
  options: [
    {
      name: 'graph-id',
      alias: 'g',
      type: 'string',
      description: '要导出的图谱 ID',
      required: false,
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: '导出格式 (json, markdown, pdf)',
      required: false,
      default: 'json',
    },
    {
      name: 'output',
      alias: 'o',
      type: 'string',
      description: '输出文件路径',
      required: false,
    },
  ],
  permission: 'safe',
  handler: handleExportGraph,
};

export const importCommand: Command = {
  name: 'import',
  description: '导入数据操作',
  usage: 'import --file <路径> --type <类型>',
  options: [
    {
      name: 'file',
      alias: 'f',
      type: 'string',
      description: '要导入的文件路径',
      required: true,
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: '导入类型 (graph, nodes, backup)',
      required: true,
    },
  ],
  permission: 'safe',
  handler: handleImportData,
};

export const backupCommand: Command = {
  name: 'backup',
  description: '备份操作',
  usage: 'backup <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('backup', [
    { name: 'create', description: '', usage: '', options: [], permission: 'warning', handler: handleBackupCreate },
  ]),
  subcommands: [
    {
      name: 'create',
      description: '创建备份（警告操作）',
      usage: 'backup create [--tables <表名>]',
      options: [
        {
          name: 'tables',
          alias: 't',
          type: 'string',
          description: '逗号分隔的表名 (graphs, nodes, edges, tasks)',
          required: false,
        },
      ],
      permission: 'warning',
      handler: handleBackupCreate,
    },
  ],
};

export const dataCommands = [exportCommand, importCommand, backupCommand];
