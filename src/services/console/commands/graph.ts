import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { graphsApi } from '../../api/graphs';
import { nodesApi } from '../../api/nodes';

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: `请指定子命令。可用子命令: ${subcommandNames}`,
    };
  };
};

const handleGraphCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const name = args.options.name as string;
  const description = args.options.description as string | undefined;

  if (!name) {
    return { success: false, error: '图谱名称是必需的' };
  }

  try {
    const result = await graphsApi.create({
      title: name,
      description: description,
    });

    return {
      success: true,
      data: result,
      message: `图谱 "${name}" 创建成功`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建图谱失败';
    return { success: false, error: message };
  }
};

const handleGraphList = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const page = (args.options.page as number) || 1;
  const limit = (args.options.limit as number) || 10;

  try {
    const result = await graphsApi.list();
    const graphs = result as Array<{ id: string; title: string; description?: string; created_at?: string }>;
    const startIndex = (page - 1) * limit;
    const paginatedGraphs = graphs.slice(startIndex, startIndex + limit);

    const graphList = paginatedGraphs.map((g, index) => ({
      index: startIndex + index + 1,
      id: g.id,
      title: g.title,
      description: g.description || '',
      created_at: g.created_at || '',
    }));

    return {
      success: true,
      data: {
        graphs: graphList,
        total: graphs.length,
        page,
        limit,
        totalPages: Math.ceil(graphs.length / limit),
      },
      message: `找到 ${graphs.length} 个图谱，当前第 ${page} 页`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取图谱列表失败';
    return { success: false, error: message };
  }
};

const handleGraphDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的' };
  }

  try {
    await graphsApi.delete(graphId);
    return {
      success: true,
      message: `图谱 ${graphId} 已删除`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除图谱失败';
    return { success: false, error: message };
  }
};

const handleGraphShow = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的' };
  }

  try {
    const result = await graphsApi.get(graphId);
    return {
      success: true,
      data: result,
      message: `图谱 ${graphId} 的详细信息`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取图谱详情失败';
    return { success: false, error: message };
  }
};

const handleNodeList = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的 (--graph)' };
  }

  try {
    const result = await graphsApi.getNodes(graphId);
    const nodes = result as unknown as Array<{ id: string; title: string; level?: string; content?: string }>;

    const nodeList = nodes.map((n, index) => ({
      index: index + 1,
      id: n.id,
      title: n.title,
      level: n.level || 'unknown',
    }));

    return {
      success: true,
      data: {
        nodes: nodeList,
        total: nodes.length,
      },
      message: `在图谱 ${graphId} 中找到 ${nodes.length} 个节点`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取节点列表失败';
    return { success: false, error: message };
  }
};

const handleNodeCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const title = args.options.title as string;

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的 (--graph)' };
  }

  if (!title) {
    return { success: false, error: '节点标题是必需的 (--title)' };
  }

  try {
    const result = await nodesApi.create({
      graph_id: graphId,
      title: title,
    });

    return {
      success: true,
      data: result,
      message: `节点 "${title}" 在图谱 ${graphId} 中创建成功`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建节点失败';
    return { success: false, error: message };
  }
};

const handleNodeDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const nodeId = args.positional[0] || (args.options['node-id'] as string);

  if (!nodeId) {
    return { success: false, error: '节点 ID 是必需的' };
  }

  try {
    await nodesApi.delete(nodeId);
    return {
      success: true,
      message: `节点 ${nodeId} 已删除`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除节点失败';
    return { success: false, error: message };
  }
};

export const graphCommand: Command = {
  name: 'graph',
  description: '图谱操作',
  usage: 'graph <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('graph', [
    { name: 'create', description: '', usage: '', options: [], permission: 'safe', handler: handleGraphCreate },
    { name: 'list', description: '', usage: '', options: [], permission: 'safe', handler: handleGraphList },
    { name: 'delete', description: '', usage: '', options: [], permission: 'danger', handler: handleGraphDelete },
    { name: 'show', description: '', usage: '', options: [], permission: 'safe', handler: handleGraphShow },
  ]),
  subcommands: [
    {
      name: 'create',
      description: '创建新图谱',
      usage: 'graph create --name <名称> [--description <描述>]',
      options: [
        {
          name: 'name',
          alias: 'n',
          type: 'string',
          description: '图谱名称',
          required: true,
        },
        {
          name: 'description',
          alias: 'd',
          type: 'string',
          description: '图谱描述',
          required: false,
        },
      ],
      permission: 'safe',
      handler: handleGraphCreate,
    },
    {
      name: 'list',
      description: '列出所有图谱',
      usage: 'graph list [--page 1] [--limit 10]',
      options: [
        {
          name: 'page',
          alias: 'p',
          type: 'number',
          description: '页码',
          required: false,
          default: 1,
        },
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: '每页数量',
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleGraphList,
    },
    {
      name: 'delete',
      description: '删除图谱（危险操作）',
      usage: 'graph delete <图谱ID>',
      options: [
        {
          name: 'graph-id',
          alias: 'g',
          type: 'string',
          description: '要删除的图谱 ID',
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleGraphDelete,
    },
    {
      name: 'show',
      description: '显示图谱详情',
      usage: 'graph show <图谱ID>',
      options: [
        {
          name: 'graph-id',
          alias: 'g',
          type: 'string',
          description: '要查看的图谱 ID',
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleGraphShow,
    },
  ],
};

export const nodeCommand: Command = {
  name: 'node',
  description: '节点操作',
  usage: 'node <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('node', [
    { name: 'list', description: '', usage: '', options: [], permission: 'safe', handler: handleNodeList },
    { name: 'create', description: '', usage: '', options: [], permission: 'safe', handler: handleNodeCreate },
    { name: 'delete', description: '', usage: '', options: [], permission: 'danger', handler: handleNodeDelete },
  ]),
  subcommands: [
    {
      name: 'list',
      description: '列出图谱中的节点',
      usage: 'node list --graph <图谱ID>',
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: '图谱 ID',
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleNodeList,
    },
    {
      name: 'create',
      description: '创建新节点',
      usage: 'node create --graph <图谱ID> --title <标题>',
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: '图谱 ID',
          required: true,
        },
        {
          name: 'title',
          alias: 't',
          type: 'string',
          description: '节点标题',
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleNodeCreate,
    },
    {
      name: 'delete',
      description: '删除节点（危险操作）',
      usage: 'node delete <节点ID>',
      options: [
        {
          name: 'node-id',
          alias: 'n',
          type: 'string',
          description: '要删除的节点 ID',
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleNodeDelete,
    },
  ],
};

export const graphCommands = [graphCommand, nodeCommand];
