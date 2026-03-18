import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
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
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        refreshToken: null,
        sseStatus: 'disconnected',
        sseError: null,
        setUser: (user, token, refreshToken = null) => {
          console.log('[useStore] setUser 被调用:', { 
            hasUser: !!user, 
            hasToken: !!token, 
            hasRefreshToken: !!refreshToken 
          });
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
          console.log('[useStore] clearAuth 被调用');
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
        onRehydrateStorage: () => {
          console.log('[useStore] 从 localStorage 恢复数据');
          return (state) => {
            if (state) {
              console.log('[useStore] 恢复的数据:', { 
                hasUser: !!state.user, 
                hasToken: !!state.token, 
                hasRefreshToken: !!state.refreshToken 
              });
            }
          };
        }
      }
    ),
    { name: 'AuthStore' }
  )
);
