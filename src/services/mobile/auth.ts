import { getMobileSupabaseClient } from '@/lib/supabase';
import type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from '@shared/types/api';
import type { User } from '@shared/types/user';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { IAuthApi } from '../api/contracts/IAuthApi';
import { AppError, SharedErrorCodes } from "@/utils/errors";

const toUser = (supabaseUser: SupabaseUser | null): User | null => {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name,
    user_metadata: supabaseUser.user_metadata,
  };
};

export const mobileAuthApi: IAuthApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const client = getMobileSupabaseClient();
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
      user: toUser(authData.user),
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
      user: toUser(authData.user),
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
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    return { user: toUser(user) };
  },

  updateProfile: async (data: UpdateProfileData): Promise<{ user: User | null }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new AppError('Supabase client not initialized', SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    const { data: authData, error } = await client.auth.updateUser({
      data: data,
    });

    if (error) {
      throw new AppError(error.message, SharedErrorCodes.DATABASE_QUERY_ERROR, 500);
    }

    return { user: toUser(authData.user) };
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const client = getMobileSupabaseClient();
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
      user: toUser(data.user),
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
