import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  clearAuth: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      sseStatus: 'disconnected',
      sseError: null,
      setUser: (user, token, refreshToken = null) => {
        set({ 
          user, 
          token, 
          ...(refreshToken !== undefined ? { refreshToken } : {}) 
        });
      },
      setSSEStatus: (status, error = null) => {
        set({ sseStatus: status, sseError: error });
      },
      clearAuth: () => {
        set({ 
          user: null, 
          token: null, 
          refreshToken: null,
          sseStatus: 'disconnected',
          sseError: null 
        });
      },
    }),
    {
      name: 'knowledge-map-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
