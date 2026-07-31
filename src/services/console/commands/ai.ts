import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { aiApi } from '../../api/ai';
import { graphsApi } from '../../api/graphs';
import { nodesApi } from '../../api/nodes';
import { AppError, SharedErrorCodes } from "@/utils/errors";
import i18n from '../../../i18n';

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: i18n.t('console.commands.common.specifySubcommand', { subcommands: subcommandNames }),
    };
  };
};

const handleAiAnalyze = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const type = (args.options.type as string) || 'structure';

  if (!graphId) {
    return { success: false, error: i18n.t('console.commands.ai.graphIdRequiredOption') };
  }

  const validTypes = ['structure', 'content', 'connections', 'learning-path'];
  if (!validTypes.includes(type)) {
    return { success: false, error: i18n.t('console.commands.ai.invalidAnalysisType', { types: validTypes.join(', ') }) };
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
          nodes,
        };
        break;
      }
      default:
        result = await graphsApi.analyze(graphId);
    }

    return {
      success: true,
      data: result,
      message: i18n.t('console.commands.ai.analyzeSuccess', { graphId, type }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.t('console.commands.ai.analyzeGraphFailed');
    return { success: false, error: message };
  }
};

const handleAiGenerate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const type = args.options.type as string;
  const nodeId = args.options.node as string;

  if (!type) {
    return { success: false, error: i18n.t('console.commands.ai.generateTypeRequired') };
  }

  if (!nodeId) {
    return { success: false, error: i18n.t('console.commands.ai.nodeIdRequiredOption') };
  }

  const validTypes = ['content', 'learning-material', 'cards', 'expansion'];
  if (!validTypes.includes(type)) {
    return { success: false, error: i18n.t('console.commands.ai.invalidGenerateType', { types: validTypes.join(', ') }) };
  }

  try {
    const node = await nodesApi.get(nodeId);
    const nodeTitle = node.title || i18n.t('console.commands.common.noTitle');
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
      message: i18n.t('console.commands.ai.generateSuccess', { nodeId, type }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.t('console.commands.ai.generateContentFailed');
    return { success: false, error: message };
  }
};

const handleAiBatch = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const graphId = args.options.graph as string;
  const operation = args.options.operation as string;

  if (!graphId) {
    return { success: false, error: i18n.t('console.commands.ai.graphIdRequiredOption') };
  }

  if (!operation) {
    return { success: false, error: i18n.t('console.commands.ai.operationTypeRequired') };
  }

  const validOperations = ['expand', 'cards', 'analyze'];
  if (!validOperations.includes(operation)) {
    return { success: false, error: i18n.t('console.commands.ai.invalidOperationType', { operations: validOperations.join(', ') }) };
  }

  try {
    const nodes = await graphsApi.getNodes(graphId);
    const nodeArray = nodes as unknown as Array<{ id: string; title: string; content?: string }>;

    if (!nodeArray || nodeArray.length === 0) {
      return { success: false, error: i18n.t('console.commands.ai.noNodesInGraph') };
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
              error: i18n.t('console.commands.ai.analysisFailed'),
            });
          }
        }
        result = analysisResults;
        break;
      }
      default:
        throw new AppError(i18n.t('console.commands.ai.unknownOperation'), SharedErrorCodes.VALIDATION_ERROR, 400);
    }

    return {
      success: true,
      data: {
        operation,
        graphId,
        processedCount,
        result,
      },
      message: i18n.t('console.commands.ai.batchSuccess', { operation, graphId, count: processedCount }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18n.t('console.commands.ai.batchOperationFailed');
    return { success: false, error: message };
  }
};

export const aiCommand: Command = {
  name: 'ai',
  description: i18n.t('console.commands.ai.aiDesc'),
  usage: i18n.t('console.commands.ai.aiUsage'),
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
      description: i18n.t('console.commands.ai.aiAnalyzeDesc'),
      usage: i18n.t('console.commands.ai.aiAnalyzeUsage'),
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: i18n.t('console.commands.ai.graphToAnalyzeOption'),
          required: true,
        },
        {
          name: 'type',
          alias: 't',
          type: 'string',
          description: i18n.t('console.commands.ai.analysisTypeOption'),
          required: false,
          default: 'structure',
        },
      ],
      permission: 'safe',
      handler: handleAiAnalyze,
    },
    {
      name: 'generate',
      description: i18n.t('console.commands.ai.aiGenerateDesc'),
      usage: i18n.t('console.commands.ai.aiGenerateUsage'),
      options: [
        {
          name: 'type',
          alias: 't',
          type: 'string',
          description: i18n.t('console.commands.ai.generateTypeOption'),
          required: true,
        },
        {
          name: 'node',
          alias: 'n',
          type: 'string',
          description: i18n.t('console.commands.ai.nodeOption'),
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleAiGenerate,
    },
    {
      name: 'batch',
      description: i18n.t('console.commands.ai.aiBatchDesc'),
      usage: i18n.t('console.commands.ai.aiBatchUsage'),
      options: [
        {
          name: 'graph',
          alias: 'g',
          type: 'string',
          description: i18n.t('console.commands.ai.graphOptionAi'),
          required: true,
        },
        {
          name: 'operation',
          alias: 'o',
          type: 'string',
          description: i18n.t('console.commands.ai.operationOption'),
          required: true,
        },
      ],
      permission: 'warning',
      handler: handleAiBatch,
    },
  ],
};

export const aiCommands = [aiCommand];
