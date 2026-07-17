import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Clock, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks';
import { commandRegistry, type CommandResult, type CommandContext } from '@/services/console';
import { useConsoleStore } from '@/store/useConsoleStore';
import { ConsoleInput, type ConsoleInputRef } from './ConsoleInput';
import { ConsoleOutput, type ConsoleOutputRef } from './ConsoleOutput';
import { ConsoleHistory } from './ConsoleHistory';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { PerformanceTab } from './PerformanceTab';

type TabType = 'console' | 'performance';

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  context: CommandContext;
  onToggleMinimize?: () => void;
  isMinimized?: boolean;
}

export const Console: React.FC<ConsoleProps> = ({
  isOpen,
  onClose,
  context,
  onToggleMinimize,
  isMinimized = false,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  
  const {
    input,
    setInput,
    history,
    output,
    isLoading,
    confirmState,
    pendingConfirm,
    setIsOpen,
    addToHistory,
    clearHistory,
    addOutput,
    clearOutput,
    setIsLoading,
    cancelConfirm,
    setPendingConfirm,
    clearPendingConfirm,
  } = useConsoleStore();
  
  const [showHistoryPanel, setShowHistoryPanel] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabType>('console');
  const outputRef = useRef<ConsoleOutputRef>(null);
  const inputRef = useRef<ConsoleInputRef>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(isOpen);
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollToBottom();
    }
  }, [output]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getCommandPermission = useCallback((command: string): 'safe' | 'warning' | 'danger' => {
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

  const executeCommandInternal = useCallback(async (command: string) => {
    if (!command.trim()) return;

    setInput('');
    addOutput({ type: 'input', content: command });
    setIsLoading(true);

    try {
      const result = await commandRegistry.execute(command, context);
      addOutput({ type: 'output', content: result.message || '', result });
      addToHistory(command, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: CommandResult = { success: false, error: errorMessage };
      addOutput({ type: 'output', content: errorMessage, result });
      addToHistory(command, result);
    } finally {
      setIsLoading(false);
    }
  }, [context, setInput, addOutput, addToHistory, setIsLoading]);

  const executeCommand = useCallback(async (command: string) => {
    if (pendingConfirm.active) {
      const answer = command.trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        addOutput({ type: 'input', content: 'y' });
        pendingConfirm.onConfirm();
        clearPendingConfirm();
      } else {
        addOutput({ type: 'input', content: command });
        addOutput({ type: 'output', content: t('console.confirm.cancelled') });
        pendingConfirm.onCancel();
        clearPendingConfirm();
      }
      setInput('');
      return;
    }

    if (!command.trim()) return;

    setInput('');
    addOutput({ type: 'input', content: command });

    const permission = getCommandPermission(command);

    if (permission === 'safe') {
      await executeCommandInternal(command);
      return;
    }

    const confirmMessage = permission === 'danger'
      ? `${t('console.confirm.dangerTitle')}\n\n${t('console.confirm.dangerDesc', { command })}\n\n${t('console.confirm.prompt')}`
      : `${t('console.confirm.warningTitle')}\n\n${t('console.confirm.warningDesc', { command })}\n\n${t('console.confirm.prompt')}`;

    addOutput({ type: 'output', content: confirmMessage });

    setPendingConfirm({
      active: true,
      command,
      message: confirmMessage,
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const result = await commandRegistry.execute(command, context);
          addOutput({ type: 'output', content: result.message || '', result });
          addToHistory(command, result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const result: CommandResult = { success: false, error: errorMessage };
          addOutput({ type: 'output', content: errorMessage, result });
          addToHistory(command, result);
        } finally {
          setIsLoading(false);
        }
      },
      onCancel: () => {
        addOutput({ type: 'output', content: t('console.confirm.cancelled') });
      },
    });
    inputRef.current?.focus();
  }, [pendingConfirm, executeCommandInternal, getCommandPermission, addOutput, addToHistory, setInput, setPendingConfirm, clearPendingConfirm, context, setIsLoading]);

  const handleHistorySelect = useCallback((command: string) => {
    setInput(command);
    setShowHistoryPanel(false);
    inputRef.current?.focus();
  }, [setInput]);

  const handleClearOutput = useCallback(() => {
    clearOutput();
  }, [clearOutput]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={consoleRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed bottom-4 right-4 w-[600px] max-h-[70vh] rounded-xl shadow-2xl border overflow-hidden z-50 flex flex-col ${
              isDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-white border-gray-200'
            }`}
          >
            <div
              className={`flex items-center justify-between px-4 py-2 border-b cursor-move select-none ${
                isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'console'
                      ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-800'
                      : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Terminal size={14} />
                  {t('console.tabs.console')}
                </button>
                <button
                  onClick={() => setActiveTab('performance')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'performance'
                      ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-800'
                      : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Activity size={14} />
                  {t('console.tabs.performance')}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {activeTab === 'console' && (
                  <button
                    onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                    className={`p-1.5 rounded-md transition-colors ${
                      showHistoryPanel
                        ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-800'
                        : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                    title={t('console.toolbar.history')}
                  >
                    <Clock size={16} />
                  </button>
                )}
                {onToggleMinimize && (
                  <button
                    onClick={onToggleMinimize}
                    className={`p-1.5 rounded-md transition-colors ${
                      isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                    title={isMinimized ? t('console.toolbar.expand') : t('console.toolbar.minimize')}
                  >
                    {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`p-1.5 rounded-md transition-colors ${
                    isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  }`}
                  title={t('console.toolbar.close')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {activeTab === 'console' ? (
                <>
                  <div className={`flex-1 flex flex-col min-w-0 ${showHistoryPanel ? 'border-r' : ''} ${
                    isDark ? 'border-slate-700' : 'border-gray-200'
                  }`}>
                    <ConsoleOutput
                      ref={outputRef}
                      output={output}
                      isDark={isDark}
                      onClear={handleClearOutput}
                    />
                    <ConsoleInput
                      ref={inputRef}
                      value={input}
                      onChange={setInput}
                      onSubmit={executeCommand}
                      isDark={isDark}
                      isLoading={isLoading}
                      pendingConfirmActive={pendingConfirm.active}
                      history={history}
                    />
                  </div>

                  <AnimatePresence>
                    {showHistoryPanel && (
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 200, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <ConsoleHistory
                          history={history}
                          onSelect={handleHistorySelect}
                          onClear={clearHistory}
                          isDark={isDark}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <PerformanceTab isDark={isDark} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={cancelConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDangerous={confirmState.type === 'danger'}
        requireConfirmText={confirmState.type === 'danger' && !!confirmState.confirmText}
        confirmTextToMatch={confirmState.confirmText}
      />
    </>
  );
};
