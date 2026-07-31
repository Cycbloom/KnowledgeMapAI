import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { graphsApi } from '../../api/graphs';
import { nodesApi } from '../../api/nodes';
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

const handleGraphCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const name = args.options.name as string;
  const description = args.options.description as string | undefined;

  if (!name) {
    return { success: false, error: i18next.t('console.commands.graph.graphNameRequired') };
  }

  try {
    const result = await graphsApi.create({
      title: name,
      description,
    });

    return {
      success: true,
      data: result,
      message: i18next.t('console.commands.graph.graphCreateSuccess', { name }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.createGraphFailed');
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
      message: i18next.t('console.commands.graph.graphListFound', { count: graphs.length, page }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.getGraphListFailed');
    return { success: false, error: message };
  }
};

const handleGraphDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);

  if (!graphId) {
    return { success: false, error: i18next.t('console.commands.graph.graphIdRequired') };
  }

  try {
    await graphsApi.delete(graphId);
    return {
      success: true,
      message: i18next.t('console.commands.graph.graphDeleteSuccess', { graphId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.deleteGraphFailed');
    return { success: false, error: message };
  }
};

const handleGraphShow = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.positional[0] || (args.options['graph-id'] as string);

  if (!graphId) {
    return { success: false, error: i18next.t('console.commands.graph.graphIdRequired') };
  }

  try {
    const result = await graphsApi.get(graphId);
    return {
      success: true,
      data: result,
      message: i18next.t('console.commands.graph.graphDetail', { graphId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.getGraphDetailFailed');
    return { success: false, error: message };
  }
};

const handleNodeList = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;

  if (!graphId) {
    return { success: false, error: i18next.t('console.commands.graph.graphIdRequiredOption') };
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
      message: i18next.t('console.commands.graph.nodeListFound', { graphId, count: nodes.length }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.getNodeListFailed');
    return { success: false, error: message };
  }
};

const handleNodeCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const title = args.options.title as string;

  if (!graphId) {
    return { success: false, error: i18next.t('console.commands.graph.graphIdRequiredOption') };
  }

  if (!title) {
    return { success: false, error: i18next.t('console.commands.graph.nodeTitleRequired') };
  }

  try {
    const result = await nodesApi.create({
      graph_id: graphId,
      title,
    });

    return {
      success: true,
      data: result,
      message: i18next.t('console.commands.graph.nodeCreateSuccess', { title, graphId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.createNodeFailed');
    return { success: false, error: message };
  }
};

const handleNodeDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const nodeId = args.positional[0] || (args.options['node-id'] as string);

  if (!nodeId) {
    return { success: false, error: i18next.t('console.commands.graph.nodeIdRequired') };
  }

  try {
    await nodesApi.delete(nodeId);
    return {
      success: true,
      message: i18next.t('console.commands.graph.nodeDeleteSuccess', { nodeId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.graph.deleteNodeFailed');
    return { success: false, error: message };
  }
};

export const graphCommand: Command = {
  name: 'graph',
  description: i18next.t('console.commands.graph.graphDesc'),
  usage: i18next.t('console.commands.graph.graphUsage'),
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
      description: i18next.t('console.commands.graph.graphCreateDesc'),
      usage: i18next.t('console.commands.graph.graphCreateUsage'),
      options: [
        {
          name: 'name',
          alias: 'n',
          type: 'string',
          description: i18next.t('console.commands.graph.nameOption'),
          required: true,
        },
        {
          name: 'description',
          alias: 'd',
          type: 'string',
          description: i18next.t('console.commands.graph.descriptionOption'),
          required: false,
        },
      ],
      permission: 'safe',
      handler: handleGraphCreate,
    },
    {
      name: 'list',
      description: i18next.t('console.commands.graph.graphListDesc'),
      usage: i18next.t('console.commands.graph.graphListUsage'),
      options: [
        {
          name: 'page',
          alias: 'p',
          type: 'number',
          description: i18next.t('console.commands.graph.pageOption'),
          required: false,
          default: 1,
        },
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: i18next.t('console.commands.graph.limitOption'),
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleGraphList,
    },
    {
      name: 'delete',
      description: i18next.t('console.commands.graph.graphDeleteDesc'),
      usage: i18next.t('console.commands.graph.graphDeleteUsage'),
      options: [
        {
          name: 'graph-id',
          alias: 'g',
          type: 'string',
          description: i18next.t('console.commands.graph.graphIdOptionToDelete'),
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleGraphDelete,
    },
    {
      name: 'show',
      description: i18next.t('console.commands.graph.graphShowDesc'),
      usage: i18next.t('console.commands.graph.graphShowUsage'),
      options: [
        {
          name: 'graph-id',
          alias: 'g',
          type: 'string',
          description: i18next.t('console.commands.graph.graphIdOptionToShow'),
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
  description: i18next.t('console.commands.graph.nodeDesc'),
  usage: i18next.t('console.commands.graph.nodeUsage'),
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
      description: i18next.t('console.commands.graph.nodeListDesc'),
      usage: i18next.t('console.commands.graph.nodeListUsage'),
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: i18next.t('console.commands.graph.graphOption'),
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleNodeList,
    },
    {
      name: 'create',
      description: i18next.t('console.commands.graph.nodeCreateDesc'),
      usage: i18next.t('console.commands.graph.nodeCreateUsage'),
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: i18next.t('console.commands.graph.graphOption'),
          required: true,
        },
        {
          name: 'title',
          alias: 't',
          type: 'string',
          description: i18next.t('console.commands.graph.titleOption'),
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleNodeCreate,
    },
    {
      name: 'delete',
      description: i18next.t('console.commands.graph.nodeDeleteDesc'),
      usage: i18next.t('console.commands.graph.nodeDeleteUsage'),
      options: [
        {
          name: 'node-id',
          alias: 'n',
          type: 'string',
          description: i18next.t('console.commands.graph.nodeIdOption'),
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleNodeDelete,
    },
  ],
};

export const graphCommands = [graphCommand, nodeCommand];
