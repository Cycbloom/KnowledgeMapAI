import { getMobileSupabaseClient } from '@/lib/supabase';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from '@shared/types/api';
import type { User } from '@supabase/supabase-js';

export const mobileAuthApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: authData, error } = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
        },
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }

    return {
      user: authData.user,
      session: authData.session
        ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_in: authData.session.expires_in || 3600,
            token_type: 'bearer',
          }
        : null,
    };
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: authData, error } = await client.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    return {
      user: authData.user,
      session: authData.session
        ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            expires_in: authData.session.expires_in || 3600,
            token_type: 'bearer',
          }
        : null,
    };
  },

  logout: async (): Promise<{ message: string }> => {
    const client = getMobileSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    return { message: '登出成功' };
  },

  getUser: async (): Promise<{ user: User | null }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    return { user };
  },

  updateProfile: async (data: UpdateProfileData): Promise<{ user: User | null }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data: authData, error } = await client.auth.updateUser({
      data: data,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { user: authData.user };
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    return {
      user: data.user,
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in || 3600,
            token_type: 'bearer',
          }
        : null,
    };
  },
};
