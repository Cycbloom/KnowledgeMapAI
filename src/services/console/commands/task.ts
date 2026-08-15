import type { Command, CommandResult, ParsedArgs, CommandContext } from '../types';
import { tasksApi } from '../../api/tasks';
import i18next from 'i18next';

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
      error: i18next.t('console.commands.common.specifySubcommand', { subcommands: subcommandNames }),
    };
  };
};

const handleTaskCreate = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const title = args.options.title as string;
  const priority = (args.options.priority as string) || 'medium';

  if (!title) {
    return { success: false, error: i18next.t('console.commands.task.taskTitleRequired') };
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
      message: i18next.t('console.commands.task.taskCreateSuccess', { title, priority }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.task.createTaskFailed');
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
      title: (t.payload?.title as string) || i18next.t('console.commands.common.noTitle'),
      created_at: t.created_at || '',
    }));

    return {
      success: true,
      data: {
        tasks: taskList,
        page,
        limit,
      },
      message: i18next.t('console.commands.task.taskListFound', {
        count: tasks.length,
        statusFilter: status ? i18next.t('console.commands.task.taskListStatusFilter', { status }) : '',
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.task.getTaskListFailed');
    return { success: false, error: message };
  }
};

const handleTaskShow = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const taskId = args.positional[0] || (args.options['task-id'] as string);

  if (!taskId) {
    return { success: false, error: i18next.t('console.commands.task.taskIdRequired') };
  }

  try {
    const result = await tasksApi.list(undefined, 100, 0);
    const tasks = result.tasks as unknown as TaskItem[];
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      return { success: false, error: i18next.t('console.commands.task.taskNotFound', { taskId }) };
    }

    return {
      success: true,
      data: task,
      message: i18next.t('console.commands.task.taskDetail', { taskId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.task.getTaskDetailFailed');
    return { success: false, error: message };
  }
};

const handleTaskStatus = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const idsStr = args.options.ids as string;
  const status = args.options.status as string;

  if (!idsStr) {
    return { success: false, error: i18next.t('console.commands.task.taskIdRequiredOption') };
  }

  if (!status) {
    return { success: false, error: i18next.t('console.commands.task.statusRequired') };
  }

  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  if (!validStatuses.includes(status)) {
    return { success: false, error: i18next.t('console.commands.task.invalidStatus', { statuses: validStatuses.join(', ') }) };
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
        const message = error instanceof Error ? error.message : i18next.t('console.commands.task.updateTaskFailed');
        results.push({ id, success: false, error: message });
      }
    }

    // 合并两次 filter 扫描为单趟遍历，O(2×n) → O(n)
    let successCount = 0;
    let failCount = 0;
    for (const r of results) {
      if (r.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

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
      message: i18next.t('console.commands.task.taskStatusUpdated', { success: successCount, total: ids.length, status }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.task.updateTaskFailed');
    return { success: false, error: message };
  }
};

const handleTaskDelete = async (args: ParsedArgs, _context: CommandContext): Promise<CommandResult> => {
  const taskId = args.positional[0] || (args.options['task-id'] as string);

  if (!taskId) {
    return { success: false, error: i18next.t('console.commands.task.taskIdRequired') };
  }

  try {
    await tasksApi.delete(taskId);
    return {
      success: true,
      message: i18next.t('console.commands.task.taskDeleteSuccess', { taskId }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : i18next.t('console.commands.task.deleteTaskFailed');
    return { success: false, error: message };
  }
};

export const taskCommand: Command = {
  name: 'task',
  description: i18next.t('console.commands.task.taskDesc'),
  usage: i18next.t('console.commands.task.taskUsage'),
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
      description: i18next.t('console.commands.task.taskCreateDesc'),
      usage: i18next.t('console.commands.task.taskCreateUsage'),
      options: [
        {
          name: 'title',
          alias: 't',
          type: 'string',
          description: i18next.t('console.commands.task.taskTitleOption'),
          required: true,
        },
        {
          name: 'priority',
          alias: 'p',
          type: 'string',
          description: i18next.t('console.commands.task.priorityOption'),
          required: false,
          default: 'medium',
        },
      ],
      permission: 'safe',
      handler: handleTaskCreate,
    },
    {
      name: 'list',
      description: i18next.t('console.commands.task.taskListDesc'),
      usage: i18next.t('console.commands.task.taskListUsage'),
      options: [
        {
          name: 'status',
          alias: 's',
          type: 'string',
          description: i18next.t('console.commands.task.statusFilterOption'),
          required: false,
        },
        {
          name: 'page',
          type: 'number',
          description: i18next.t('console.commands.task.taskPageOption'),
          required: false,
          default: 1,
        },
        {
          name: 'limit',
          alias: 'l',
          type: 'number',
          description: i18next.t('console.commands.task.taskLimitOption'),
          required: false,
          default: 10,
        },
      ],
      permission: 'safe',
      handler: handleTaskList,
    },
    {
      name: 'show',
      description: i18next.t('console.commands.task.taskShowDesc'),
      usage: i18next.t('console.commands.task.taskShowUsage'),
      options: [
        {
          name: 'task-id',
          alias: 't',
          type: 'string',
          description: i18next.t('console.commands.task.taskIdOptionToShow'),
          required: true,
        },
      ],
      permission: 'safe',
      handler: handleTaskShow,
    },
    {
      name: 'status',
      description: i18next.t('console.commands.task.taskStatusDesc'),
      usage: i18next.t('console.commands.task.taskStatusUsage'),
      options: [
        {
          name: 'ids',
          type: 'string',
          description: i18next.t('console.commands.task.idsOption'),
          required: true,
        },
        {
          name: 'status',
          alias: 's',
          type: 'string',
          description: i18next.t('console.commands.task.newStatusOption'),
          required: true,
        },
      ],
      permission: 'warning',
      handler: handleTaskStatus,
    },
    {
      name: 'delete',
      description: i18next.t('console.commands.task.taskDeleteDesc'),
      usage: i18next.t('console.commands.task.taskDeleteUsage'),
      options: [
        {
          name: 'task-id',
          alias: 't',
          type: 'string',
          description: i18next.t('console.commands.task.taskIdOptionToDelete'),
          required: true,
        },
      ],
      permission: 'danger',
      handler: handleTaskDelete,
    },
  ],
};

export const taskCommands = [taskCommand];
