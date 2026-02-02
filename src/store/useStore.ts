import { create } from 'zustand';
import { User } from '../types';

type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AppState {
  user: User | null;
  token: string | null;
  sseStatus: SSEConnectionStatus;
  sseError: string | null;
  setUser: (user: User | null, token: string | null) => void;
  setSSEStatus: (status: SSEConnectionStatus, error?: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  sseStatus: 'disconnected',
  sseError: null,
  setUser: (user, token) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    set({ user, token });
  },
  setSSEStatus: (status, error = null) => {
    set({ sseStatus: status, sseError: error });
  },
}));
