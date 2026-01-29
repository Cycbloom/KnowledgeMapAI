import { create } from 'zustand';
import { User } from '../types';

interface AppState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setUser: (user, token) => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    set({ user, token });
  },
}));
