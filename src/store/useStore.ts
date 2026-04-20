import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { User } from '../types';

interface AppState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setUser: (user: User | null, token: string | null, refreshToken?: string | null) => void;
  clearAuth: () => void;
}

export const useStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        refreshToken: null,
        setUser: (user, token, refreshToken = null) => {
          set({ 
            user, 
            token, 
            ...(refreshToken !== undefined ? { refreshToken } : {}) 
          });
        },
        clearAuth: () => {
          set({ 
            user: null, 
            token: null, 
            refreshToken: null,
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
          return () => {};
        }
      }
    ),
    { name: 'AuthStore' }
  )
);
