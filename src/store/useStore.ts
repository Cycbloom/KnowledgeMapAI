import { User } from '../types';
import { createPersistedStore } from './createPersistedStore';
import { setUserContext, clearUserContext } from '../utils/errorReporter';

interface AppState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setUser: (user: User | null, token: string | null, refreshToken?: string | null) => void;
  clearAuth: () => void;
}

export const useStore = createPersistedStore<AppState>(
  'auth',
  (set) => ({
    user: null,
    token: null,
    refreshToken: null,
    setUser: (user, token, refreshToken = null) => {
      if (user) {
        setUserContext(user.id, user.email);
      } else {
        clearUserContext();
      }
      set({
        user,
        token,
        ...(refreshToken !== undefined ? { refreshToken } : {})
      });
    },
    clearAuth: () => {
      clearUserContext();
      set({
        user: null,
        token: null,
        refreshToken: null,
      });
    },
  }),
  {
    partialize: (state) => ({
      user: state.user,
      token: state.token,
      refreshToken: state.refreshToken,
    }),
  }
);
