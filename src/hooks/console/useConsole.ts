import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { commandRegistry, consoleLogger, allCommands, type CommandResult, type CommandHistoryItem, type CommandContext, type CommandPermission } from '@/services/console';
import { useConsoleStore, type ConfirmDialogType } from '@/store/useConsoleStore';

export interface UseConsoleOptions {
  userId: string;
  autoRegisterCommands?: boolean;
}

export interface UseConsoleReturn {
  isOpen: boolean;
  isMinimized: boolean;
  input: string;
  setInput: (input: string) => void;
  history: CommandHistoryItem[];
  output: Array<{
    type: 'input' | 'output';
    content: string;
    result?: CommandResult;
  }>;
  isLoading: boolean;
  context: CommandContext;
  confirmState: {
    isOpen: boolean;
    type: ConfirmDialogType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  };
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleMinimize: () => void;
  executeCommand: (command: string) => Promise<void>;
  clearHistory: () => void;
  clearOutput: () => void;
  addToHistory: (command: string, result?: CommandResult) => void;
  cancelConfirm: () => void;
}

export function useConsole(options: UseConsoleOptions): UseConsoleReturn {
  const { t } = useTranslation();
  const { userId, autoRegisterCommands = true } = options;

  const commandsRegistered = useRef(false);
  const pendingCommand = useRef<string>('');

  const context: CommandContext = {
    userId,
    consoleId: crypto.randomUUID(),
  };

  // 精确订阅实际使用的字段，避免全量订阅导致无关字段变化触发 hook 消费者重渲染
  const store = useConsoleStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      isMinimized: s.isMinimized,
      input: s.input,
      history: s.history,
      output: s.output,
      isLoading: s.isLoading,
      confirmState: s.confirmState,
      setInput: s.setInput,
      addOutput: s.addOutput,
      setIsLoading: s.setIsLoading,
      addToHistory: s.addToHistory,
      setConfirmState: s.setConfirmState,
      cancelConfirm: s.cancelConfirm,
      open: s.open,
      close: s.close,
      toggle: s.toggle,
      toggleMinimize: s.toggleMinimize,
      clearHistory: s.clearHistory,
      clearOutput: s.clearOutput,
    })),
  );

  useEffect(() => {
    if (autoRegisterCommands && !commandsRegistered.current) {
      commandsRegistered.current = true;
      allCommands.forEach((command) => {
        commandRegistry.register(command);
      });
    }
  }, [autoRegisterCommands]);

  const getCommandPermission = useCallback((command: string): CommandPermission => {
    const parts = command.trim().split(/\s+/);
    const commandName = parts[0];
    const subcommandName = parts[1];

    const cmd = commandRegistry.find(commandName);
    if (!cmd) return 'safe';

    if (subcommandName && cmd.subcommands) {
      const subcmd = cmd.subcommands.find((s) => s.name === subcommandName);
      if (subcmd) return subcmd.permission;
    }

    return cmd.permission;
  }, []);

  const getConfirmMessage = useCallback((command: string, permission: CommandPermission): string => {
    const parts = command.trim().split(/\s+/);
    const commandName = parts[0];
    const subcommandName = parts[1];

    let operation = command;
    
    if (subcommandName) {
      operation = `${commandName} ${subcommandName}`;
    }

    if (permission === 'danger') {
      return t('console.confirmation.dangerMessage', { operation });
    }

    return t('console.confirmation.warningMessage', { operation });
  }, [t]);

  const executeCommandInternal = useCallback(async (command: string) => {
    if (!command.trim()) return;

    store.setInput('');
    store.addOutput({ type: 'input', content: command });
    store.setIsLoading(true);

    const startTime = Date.now();
    const permission = getCommandPermission(command);

    try {
      const result = await commandRegistry.execute(command, context);
      const duration = Date.now() - startTime;
      const message = result.message || result.error || '';

      store.addOutput({ type: 'output', content: message, result });
      store.addToHistory(command, result);

      consoleLogger.log(command, permission, result, userId, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: CommandResult = { success: false, error: errorMessage };

      store.addOutput({ type: 'output', content: errorMessage, result });
      store.addToHistory(command, result);

      consoleLogger.log(command, permission, result, userId, duration);
    } finally {
      store.setIsLoading(false);
    }
  }, [context, store, getCommandPermission, userId]);

  const showConfirmDialog = useCallback(
    (
      type: ConfirmDialogType,
      command: string,
      onConfirm: () => void
    ) => {
      const permission = getCommandPermission(command);
      const message = getConfirmMessage(command, permission);

      store.setConfirmState({
        isOpen: true,
        type,
        title: type === 'danger' ? t('console.confirmation.dangerTitle') : t('console.confirmation.warningTitle'),
        message,
        confirmText: type === 'danger' ? 'CONFIRM' : undefined,
        onConfirm,
      });
    },
    [getCommandPermission, getConfirmMessage, store, t]
  );

  const cancelConfirm = useCallback(() => {
    store.cancelConfirm();
    pendingCommand.current = '';
  }, [store]);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      const permission = getCommandPermission(command);

      if (permission === 'safe') {
        await executeCommandInternal(command);
        return;
      }

      pendingCommand.current = command;

      const confirmType: ConfirmDialogType = permission === 'danger' ? 'danger' : 'warning';

      showConfirmDialog(confirmType, command, () => {
        store.cancelConfirm();
        executeCommandInternal(command);
      });
    },
    [getCommandPermission, executeCommandInternal, showConfirmDialog, store]
  );

  return {
    isOpen: store.isOpen,
    isMinimized: store.isMinimized,
    input: store.input,
    setInput: store.setInput,
    history: store.history,
    output: store.output,
    isLoading: store.isLoading,
    context,
    confirmState: store.confirmState,
    open: store.open,
    close: store.close,
    toggle: store.toggle,
    toggleMinimize: store.toggleMinimize,
    executeCommand,
    clearHistory: store.clearHistory,
    clearOutput: store.clearOutput,
    addToHistory: store.addToHistory,
    cancelConfirm,
  };
}