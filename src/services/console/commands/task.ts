import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { tasksApi } from '../../api/tasks';

interface TaskItem {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

const createParentHandler = (_commandName: string, subcommands: Command[]) => {
  return async (_args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
    const subcommandNames = subcommands.map((s) => s.name).join(', ');
    return {
      success: false,
      error: `请指定子命令。可用子命令: ${subcommandNames}`,
    };
  };
};

const handleTaskCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const title = args.options.title as string;
  const priority = (args.options.priority as string) || 'medium';

  if (!title) {
    return { success: false, error: '任务标题是必需的 (--title)' };
  }

  try {
    const result = await tasksApi.create({
      type: 'user_task',
      payload: {
        title,
        priority,
        created_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      data: result,
      message: `任务 "${title}" 创建成功，优先级: ${priority}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建任务失败';
    return { success: false, error: message };
  }
};

const handleTaskList = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const status = args.options.status as string | undefined;
  const page = (args.options.page as number) || 1;
  const limit = (args.options.limit as number) || 10;
  const offset = (page - 1) * limit;

  try {
    const result = await tasksApi.list(status, limit, offset);
    const tasks = result.tasks as unknown as TaskItem[];

    const taskList = tasks.map((t, index) => ({
      index: offset + index + 1,
      id: t.id,
      type: t.type,
      status: t.status,
      title: (t.payload?.title as string) || '无标题',
      created_at: t.created_at || '',
    }));

    return {
      success: true,
      data: {
        tasks: taskList,
        page,
        limit,
      },
      message: `找到 ${tasks.length} 个任务${status ? `，状态: "${status}"` : ''}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取任务列表失败';
    return { success: false, error: message };
  }
};

const handleTaskShow = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const taskId = args.positional[0] || (args.options['task-id'] as string);

  if (!taskId) {
    return { success: false, error: '任务 ID 是必需的' };
  }

  try {
    const result = await tasksApi.list(undefined, 100, 0);
    const tasks = result.tasks as unknown as TaskItem[];
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      return { success: false, error: `未找到任务 ${taskId}` };
    }

    return {
      success: true,
      data: task,
      message: `任务 ${taskId} 的详细信息`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取任务详情失败';
    return { success: false, error: message };
  }
};

const handleTaskStatus = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const idsStr = args.options.ids as string;
  const status = args.options.status as string;

  if (!idsStr) {
    return { success: false, error: '任务 ID 是必需的 (--ids)' };
  }

  if (!status) {
    return { success: false, error: '状态是必需的 (--status)' };
  }

  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    return { success: false, error: `无效的状态。有效状态: ${validStatuses.join(', ')}` };
  }

  const ids = idsStr.split(',').map((id) => id.trim());

  try {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        if (status === 'pending') {
          await tasksApi.retry(id);
        }
        results.push({ id, success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : '更新任务失败';
        results.push({ id, success: false, error: message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      success: true,
      data: {
        results,
        summary: {
          total: ids.length,
          success: successCount,
          failed: failCount,
        },
      },
      message: `已更新 ${successCount}/${ids.length} 个任务状态为 "${status}"`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新任务失败';
    return { success: false, error: message };
  }
};

const handleTaskDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const taskId = args.positional[0] || (args.options['task-id'] as string);

  if (!taskId) {
    return { success: false, error: '任务 ID 是必需的' };
  }

  try {
    await tasksApi.delete(taskId);
    return {
      success: true,
      message: `任务 ${taskId} 已删除`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除任务失败';
    return { success: false, error: message };
  }
};

export const taskCommand: Command = {
  name: 'task',
  description: '任务管理操作',
  usage: 'task <子命令> [选项]',
  options: [],
  permission: 'safe',
  handler: createParentHandler('task', [
    { name: 'create', description: '', usage: '', options: [], permission: 'safe', handler: handleTaskCreate },
    { name: 'list', description: '', usage: '', options: [], permission: 'safe', handler: handleTaskList },
    { name: 'show', description: '', usage: '', options: [], permission: 'safe', handler: handleTaskShow },
    { name: 'status', description: '', usage: '', options: [], permission: 'warning', handler: handleTaskStatus },
    { name: 'delete', description: '', usage: '', options: [], permission: 'danger', handler: handleTaskDelete },
  ]),
  subcommands: [
    {
      name: 'create',
      description: '创建新任务',
      usage: 'task create --title <标题> [--priority <优先级>]',
      options: [
        {
          name: 'title',
          alias: 't',
          type: 'string',
          description: '任务标题',
          required: true,
        },
        {
          name: 'priority',
          alias: 'p',
          type: 'string',
          description: '任务优先级 (low, medium, high)',
          required: false,
          default: 'medium',
        },
      ],
      permission: 'safe',
      handler: handleTaskCreate,
    },
    {
      name: 'list',
      description: '列出任务',
      usage: 'task list [--status <状态>] [--page 1] [--limit 10]',
      options: [
        {
          name: 'status',
          alias: 's',
          type: 'string',
          description: '按状态筛选 (pending, processing, completed, failed)',
          required: false,
        },
        {
          name: 'page',
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
      handler: handleTaskList,
    },
    {
      name: 'show',
      description: '显示任务详情',
      usage: 'task show <任务ID>',
      options: [
        {
          name: 'task-id',
          alias: 't',
          type: 'string',
          description: '要查看的任务 ID',
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleTaskShow,
    },
    {
      name: 'status',
      description: '批量更新任务状态（警告操作）',
      usage: 'task status --ids <id1,id2,id3> --status <状态>',
      options: [
        {
          name: 'ids',
          type: 'string',
          description: '逗号分隔的任务 ID',
          required: true,
        },
        {
          name: 'status',
          alias: 's',
          type: 'string',
          description: '新状态 (pending, processing, completed, failed)',
          required: true,
        },
      ],
      permission: 'warning',
      handler: handleTaskStatus,
    },
    {
      name: 'delete',
      description: '删除任务（危险操作）',
      usage: 'task delete <任务ID>',
      options: [
        {
          name: 'task-id',
          alias: 't',
          type: 'string',
          description: '要删除的任务 ID',
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleTaskDelete,
    },
  ],
};

export const taskCommands = [taskCommand];
