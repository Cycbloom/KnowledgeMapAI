import i18next from 'i18next';
import { request } from './client';
import { authConfig } from '@/config/authConfig';
import { getSupabaseClient } from '@/utils/supabase';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from '@shared/types/api';
import type { User } from '@shared/types/user';
import type { IAuthApi } from './contracts/IAuthApi';
import { logger } from '@/utils/logger';
import { AppError, SharedErrorCodes } from "@/utils/errors";

const localAuthApi = {
  register: (data: RegisterData): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: LoginData): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: (): Promise<{ message: string }> =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  getUser: (): Promise<{ user: User | null }> =>
    request<{ user: User | null }>('/auth/user'),

  updateProfile: (data: UpdateProfileData): Promise<{ user: User | null }> =>
    request<{ user: User | null }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  refreshToken: (refreshToken: string): Promise<AuthResponse> =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

const supabaseAuthApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
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
      logger.error('[authApi.login] Supabase client 未初始化');
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
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
    return { message: i18next.t('profile.messages.logoutSuccess') };
  },

  getUser: async (): Promise<{ user: User | null }> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    return { user: user as User | null };
  },

  updateProfile: async (data: UpdateProfileData): Promise<{ user: User | null }> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data: authData, error } = await client.auth.updateUser({
      data,
    });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return { user: authData.user as User | null };
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const client = getSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
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

export const authApi: IAuthApi = {
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

  getUser: (): Promise<{ user: User | null }> => {
    if (authConfig.isSupabase()) {
      return supabaseAuthApi.getUser();
    }
    return localAuthApi.getUser();
  },

  updateProfile: (data: UpdateProfileData): Promise<{ user: User | null }> => {
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
