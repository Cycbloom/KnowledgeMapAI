import { create } from 'zustand';

export type NotificationStatus = 'loading' | 'generating' | 'success' | 'error' | 'timeout' | 'info';

export interface ManagedNotification {
  id: string;
  kind: string;
  priority: number;
  status: NotificationStatus;
  dismissible: boolean;
  autoDismissMs?: number;
  data?: unknown;
  action?: () => void;
  onDismiss?: () => void;
  createdAt: number;
}

export type ManagedNotificationInput = Omit<ManagedNotification, 'createdAt'>;

interface NotificationManagerState {
  entries: ManagedNotification[];
  queue: ManagedNotification[];
  maxVisible: number;
  show: (input: ManagedNotificationInput) => void;
  update: (id: string, patch: Partial<Omit<ManagedNotification, 'id' | 'createdAt'>>) => void;
  dismiss: (id: string) => void;
  clear: (kind?: string) => void;
  setMaxVisible: (maxVisible: number) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function sortByPriorityTime(list: ManagedNotification[]) {
  return [...list].sort(
    (a, b) => b.priority - a.priority || a.createdAt - b.createdAt,
  );
}

function scheduleAutoDismiss(entry: ManagedNotification) {
  clearTimer(entry.id);
  if (typeof entry.autoDismissMs === 'number' && entry.autoDismissMs > 0) {
    timers.set(
      entry.id,
      setTimeout(() => {
        useNotificationManager.getState().dismiss(entry.id);
      }, entry.autoDismissMs),
    );
  }
}

function promote(state: NotificationManagerState) {
  const entries = [...state.entries];
  const queue = [...state.queue];
  while (entries.length < state.maxVisible && queue.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i++) {
      const current = queue[bestIndex];
      const candidate = queue[i];
      if (
        candidate.priority > current.priority ||
        (candidate.priority === current.priority && candidate.createdAt < current.createdAt)
      ) {
        bestIndex = i;
      }
    }
    const [next] = queue.splice(bestIndex, 1);
    entries.push(next);
    scheduleAutoDismiss(next);
  }
  return { entries: sortByPriorityTime(entries), queue: sortByPriorityTime(queue) };
}

export const useNotificationManager = create<NotificationManagerState>()((set, get) => ({
  entries: [],
  queue: [],
  maxVisible: 3,

  show: (input) => {
    const state = get();
    const existing =
      state.entries.find((e) => e.id === input.id) ??
      state.queue.find((e) => e.id === input.id);

    if (existing) {
      const entry: ManagedNotification = { ...input, createdAt: existing.createdAt };
      if (state.entries.some((e) => e.id === input.id)) {
        scheduleAutoDismiss(entry);
      }
      set({
        entries: sortByPriorityTime(state.entries.map((e) => (e.id === input.id ? entry : e))),
        queue: sortByPriorityTime(state.queue.map((e) => (e.id === input.id ? entry : e))),
      });
      return;
    }

    const entry: ManagedNotification = { ...input, createdAt: Date.now() };
    if (state.entries.length < state.maxVisible) {
      scheduleAutoDismiss(entry);
      set({ entries: sortByPriorityTime([...state.entries, entry]) });
    } else {
      set({ queue: sortByPriorityTime([...state.queue, entry]) });
    }
  },

  update: (id, patch) => {
    const state = get();
    const existing =
      state.entries.find((e) => e.id === id) ??
      state.queue.find((e) => e.id === id);
    if (!existing) return;
    const merged: ManagedNotification = { ...existing, ...patch };
    if (state.entries.some((e) => e.id === id)) {
      scheduleAutoDismiss(merged);
    }
    set({
      entries: state.entries.map((e) => (e.id === id ? merged : e)),
      queue: state.queue.map((e) => (e.id === id ? merged : e)),
    });
  },

  dismiss: (id) => {
    const state = get();
    clearTimer(id);
    const removed =
      state.entries.find((e) => e.id === id) ??
      state.queue.find((e) => e.id === id);
    if (!removed) return;
    const entries = state.entries.filter((e) => e.id !== id);
    const queue = state.queue.filter((e) => e.id !== id);
    const next = promote({ ...state, entries, queue });
    set(next);
    removed.onDismiss?.();
  },

  clear: (kind) => {
    const state = get();
    const removed =
      kind === undefined
        ? [...state.entries, ...state.queue]
        : [...state.entries, ...state.queue].filter((e) => e.kind === kind);
    for (const item of removed) {
      clearTimer(item.id);
    }
    const entries = kind === undefined ? [] : state.entries.filter((e) => e.kind !== kind);
    const queue = kind === undefined ? [] : state.queue.filter((e) => e.kind !== kind);
    const next = promote({ ...state, entries, queue });
    set(next);
    for (const item of removed) {
      item.onDismiss?.();
    }
  },

  setMaxVisible: (maxVisible) => {
    const state = get();
    const next = promote({ ...state, maxVisible });
    set({ ...next, maxVisible });
  },
}));
