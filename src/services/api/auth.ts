import { request } from './client';
import { authConfig } from '../../config/authConfig';
import { getSupabaseClient } from '../../lib/supabase';

export interface AuthResponse {
  user: any;
  session?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  } | null;
  error?: string;
  message?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  name?: string;
  avatar_url?: string;
  settings?: Record<string, unknown>;
}

const localAuthApi = {
  register: (data: RegisterData): Promise<AuthResponse> =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: LoginData): Promise<AuthResponse> =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: (): Promise<{ message: string }> =>
    request('/auth/logout', { method: 'POST' }),

  getUser: (): Promise<{ user: any }> =>
    request('/auth/user'),

  updateProfile: (data: UpdateProfileData): Promise<{ user: any }> =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  refreshToken: (refreshToken: string): Promise<AuthResponse> =>
    request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

const supabaseAuthApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const client = getSupabaseClient();
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
    const client = getSupabaseClient();
    if (!client) {
      console.error('[authApi.login] Supabase client 未初始化');
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
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    return { message: '登出成功' };
  },

  getUser: async (): Promise<{ user: any }> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase client not initialized');
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    return { user };
  },

  updateProfile: async (data: UpdateProfileData): Promise<{ user: any }> => {
    const client = getSupabaseClient();
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
    const client = getSupabaseClient();
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

export const authApi = {
  register: (data: RegisterData): Promise<AuthResponse> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.register(data);
    }
    return localAuthApi.register(data);
  },

  login: (data: LoginData): Promise<AuthResponse> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.login(data);
    }
    return localAuthApi.login(data);
  },

  logout: (): Promise<{ message: string }> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.logout();
    }
    return localAuthApi.logout();
  },

  getUser: (): Promise<{ user: any }> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.getUser();
    }
    return localAuthApi.getUser();
  },

  updateProfile: (data: UpdateProfileData): Promise<{ user: any }> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.updateProfile(data);
    }
    return localAuthApi.updateProfile(data);
  },

  refreshToken: (refreshToken: string): Promise<AuthResponse> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.refreshToken(refreshToken);
    }
    return localAuthApi.refreshToken(refreshToken);
  },
};
