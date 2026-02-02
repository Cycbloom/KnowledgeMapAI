import { create } from 'zustand';
import { User } from '../types';

type SSEConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface AppState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  sseStatus: SSEConnectionStatus;
  sseError: string | null;
  setUser: (user: User | null, token: string | null, refreshToken?: string | null) => void;
  setSSEStatus: (status: SSEConnectionStatus, error?: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  sseStatus: 'disconnected',
  sseError: null,
  setUser: (user, token, refreshToken = null) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    else if (token === null) localStorage.removeItem('refreshToken'); // Only clear refresh token if logging out (token is null)
    
    set({ user, token, ...(refreshToken !== undefined ? { refreshToken } : {}) });
  },
  setSSEStatus: (status, error = null) => {
    set({ sseStatus: status, sseError: error });
  },
}));
