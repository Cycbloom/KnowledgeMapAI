import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CommandResult, CommandHistoryItem } from '@/services/console';

export type ConfirmDialogType = 'warning' | 'danger';

const MAX_HISTORY_ITEMS = 50;
const MAX_OUTPUT_ITEMS = 200;

export interface OutputItem {
  type: 'input' | 'output';
  content: string;
  result?: CommandResult;
}

export interface ConfirmState {
  isOpen: boolean;
  type: ConfirmDialogType;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export interface PendingConfirmState {
  active: boolean;
  command: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConsoleState {
  isOpen: boolean;
  isMinimized: boolean;
  input: string;
  history: CommandHistoryItem[];
  output: OutputItem[];
  isLoading: boolean;
  confirmState: ConfirmState;
  pendingConfirm: PendingConfirmState;
  
  setIsOpen: (isOpen: boolean) => void;
  setIsMinimized: (isMinimized: boolean) => void;
  setInput: (input: string) => void;
  setHistory: (history: CommandHistoryItem[]) => void;
  setOutput: (output: OutputItem[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setConfirmState: (state: ConfirmState) => void;
  setPendingConfirm: (state: PendingConfirmState) => void;
  
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleMinimize: () => void;
  
  addToHistory: (command: string, result?: CommandResult) => void;
  clearHistory: () => void;
  addOutput: (item: OutputItem) => void;
  clearOutput: () => void;
  
  cancelConfirm: () => void;
  clearPendingConfirm: () => void;
}

const initialConfirmState: ConfirmState = {
  isOpen: false,
  type: 'warning',
  title: '',
  message: '',
  onConfirm: () => {},
};

const initialPendingConfirmState: PendingConfirmState = {
  active: false,
  command: '',
  message: '',
  onConfirm: () => {},
  onCancel: () => {},
};

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set) => ({
      isOpen: false,
      isMinimized: false,
      input: '',
      history: [],
      output: [],
      isLoading: false,
      confirmState: initialConfirmState,
      pendingConfirm: initialPendingConfirmState,
      
      setIsOpen: (isOpen) => set({ isOpen }),
      setIsMinimized: (isMinimized) => set({ isMinimized }),
      setInput: (input) => set({ input }),
      setHistory: (history) => set({ history }),
      setOutput: (output) => set({ output }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setConfirmState: (confirmState) => set({ confirmState }),
      setPendingConfirm: (pendingConfirm) => set({ pendingConfirm, input: '' }),
      
      open: () => set({ isOpen: true, isMinimized: false }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
      
      addToHistory: (command, result) => {
        const newItem: CommandHistoryItem = {
          id: crypto.randomUUID(),
          command,
          timestamp: Date.now(),
          result,
        };
        
        set((state) => ({
          history: [
            newItem,
            ...state.history.filter((h) => h.command !== command),
          ].slice(0, MAX_HISTORY_ITEMS),
        }));
      },
      
      clearHistory: () => set({ history: [] }),
      
      addOutput: (item) => {
        set((state) => ({
          output: [...state.output, item].slice(-MAX_OUTPUT_ITEMS),
        }));
      },
      
      clearOutput: () => set({ output: [] }),
      
      cancelConfirm: () => set({ confirmState: initialConfirmState }),
      clearPendingConfirm: () => set({ pendingConfirm: initialPendingConfirmState }),
    }),
    {
      name: 'knowledgeMap-console',
      partialize: (state) => ({
        isOpen: state.isOpen,
        isMinimized: state.isMinimized,
        history: state.history,
      }),
    }
  )
);
