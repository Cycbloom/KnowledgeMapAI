import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { aiApi } from '../../api/ai';
import { graphsApi } from '../../api/graphs';
import { nodesApi } from '../../api/nodes';
import { AppError, SharedErrorCodes } from "@/utils/errors";

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: `请指定子命令。可用子命令: ${subcommandNames}`,
    };
  };
};

const handleAiAnalyze = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const type = (args.options.type as string) || 'structure';

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的 (--graph)' };
  }

  const validTypes = ['structure', 'content', 'connections', 'learning-path'];
  if (!validTypes.includes(type)) {
    return { success: false, error: `无效的分析类型。有效类型: ${validTypes.join(', ')}` };
  }

  try {
    let result: unknown;

    switch (type) {
      case 'structure':
        result = await graphsApi.analyze(graphId);
        break;
      case 'connections':
        result = await graphsApi.getMissingConnections(graphId);
        break;
      case 'learning-path':
        result = await graphsApi.getLearningPath(graphId);
        break;
      case 'content': {
        const nodes = await graphsApi.getNodes(graphId);
        result = {
          totalNodes: Array.isArray(nodes) ? nodes.length : 0,
          nodes: nodes,
        };
        break;
      }
      default:
        result = await graphsApi.analyze(graphId);
    }

    return {
      success: true,
      data: result,
      message: `图谱 ${graphId} 分析成功 (类型: ${type})`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析图谱失败';
    return { success: false, error: message };
  }
};

const handleAiGenerate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const type = args.options.type as string;
  const nodeId = args.options.node as string;

  if (!type) {
    return { success: false, error: '生成类型是必需的 (--type)' };
  }

  if (!nodeId) {
    return { success: false, error: '节点 ID 是必需的 (--node)' };
  }

  const validTypes = ['content', 'learning-material', 'cards', 'expansion'];
  if (!validTypes.includes(type)) {
    return { success: false, error: `无效的生成类型。有效类型: ${validTypes.join(', ')}` };
  }

  try {
    const node = await nodesApi.get(nodeId);
    const nodeTitle = node.title || '无标题';
    const nodeContent = node.content || '';

    let result: unknown;

    switch (type) {
      case 'content':
        result = await aiApi.generateContent({
          topic: nodeTitle,
          context: nodeContent,
        });
        break;
      case 'learning-material':
        result = await aiApi.generateLearningMaterial({
          topic: nodeTitle,
          context: nodeContent,
        });
        break;
      case 'cards':
        result = await aiApi.generateCards({
          node_title: nodeTitle,
          node_content: nodeContent,
          count: 5,
        });
        break;
      case 'expansion':
        result = await aiApi.expand({
          node_title: nodeTitle,
          node_content: nodeContent,
        });
        break;
      default:
        result = await aiApi.generateContent({
          topic: nodeTitle,
          context: nodeContent,
        });
    }

    return {
      success: true,
      data: result,
      message: `已为节点 ${nodeId} 生成 ${type}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成内容失败';
    return { success: false, error: message };
  }
};

const handleAiBatch = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const operation = args.options.operation as string;

  if (!graphId) {
    return { success: false, error: '图谱 ID 是必需的 (--graph)' };
  }

  if (!operation) {
    return { success: false, error: '操作类型是必需的 (--operation)' };
  }

  const validOperations = ['expand', 'cards', 'analyze'];
  if (!validOperations.includes(operation)) {
    return { success: false, error: `无效的操作类型。有效操作: ${validOperations.join(', ')}` };
  }

  try {
    const nodes = await graphsApi.getNodes(graphId);
    const nodeArray = nodes as unknown as Array<{ id: string; title: string; content?: string }>;

    if (!nodeArray || nodeArray.length === 0) {
      return { success: false, error: '图谱中没有节点' };
    }

    let result: unknown;
    let processedCount = 0;

    switch (operation) {
      case 'expand':
        result = await aiApi.batchExpandGraph(nodeArray.map((n) => n.id));
        processedCount = nodeArray.length;
        break;
      case 'cards':
        result = await aiApi.batchGenerateCards(
          nodeArray.map((n) => n.id),
          { count: 3 }
        );
        processedCount = nodeArray.length;
        break;
      case 'analyze': {
        const analysisResults = [];
        for (const node of nodeArray.slice(0, 10)) {
          try {
            const analysis = await aiApi.recommendConnections({
              graph_id: graphId,
              node_title: node.title,
              node_content: node.content,
            });
            analysisResults.push({
              nodeId: node.id,
              title: node.title,
              recommendations: analysis,
            });
            processedCount++;
          } catch {
            analysisResults.push({
              nodeId: node.id,
              title: node.title,
              error: '分析失败',
            });
          }
        }
        result = analysisResults;
        break;
      }
      default:
        throw new AppError('未知操作', SharedErrorCodes.VALIDATION_ERROR, 400);
    }

    return {
      success: true,
      data: {
        operation,
        graphId,
        processedCount,
        result,
      },
      message: `批量 ${operation} 完成，处理了图谱 ${graphId} 中的 ${processedCount} 个节点`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '批量操作失败';
    return { success: false, error: message };
  }
};

export const aiCommand: Command = {
  name: 'ai',
  description: 'AI 功能操作',
  usage: 'ai <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('ai', [
    { name: 'analyze', description: '', usage: '', options: [], permission: 'safe', handler: handleAiAnalyze },
    { name: 'generate', description: '', usage: '', options: [], permission: 'safe', handler: handleAiGenerate },
    { name: 'batch', description: '', usage: '', options: [], permission: 'warning', handler: handleAiBatch },
  ]),
  subcommands: [
    {
      name: 'analyze',
      description: '使用 AI 分析图谱',
      usage: 'ai analyze --graph <图谱ID> --type <类型>',
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: '要分析的图谱 ID',
          required: true,
        },
        {
          name: 'type',
          alias: 't',
          type: 'string',
          description: '分析类型 (structure, content, connections, learning-path)',
          required: false,
          default: 'structure',
        },
      ],
      permission: 'safe',
      handler: handleAiAnalyze,
    },
    {
      name: 'generate',
      description: '使用 AI 为节点生成内容',
      usage: 'ai generate --type <类型> --node <节点ID>',
      options: [
        {
          name: 'type',
          alias: 't',
          type: 'string',
          description: '生成类型 (content, learning-material, cards, expansion)',
          required: true,
        },
        {
          name: 'node',
          alias: 'n',
          type: 'string',
          description: '节点 ID',
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleAiGenerate,
    },
    {
      name: 'batch',
      description: '批量处理图谱节点（警告操作）',
      usage: 'ai batch --graph <图谱ID> --operation <操作>',
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: '图谱 ID',
          required: true,
        },
        {
          name: 'operation',
          alias: 'o',
          type: 'string',
          description: '操作类型 (expand, cards, analyze)',
          required: true,
        },
      ],
      permission: 'warning',
      handler: handleAiBatch,
    },
  ],
};

export const aiCommands = [aiCommand];
