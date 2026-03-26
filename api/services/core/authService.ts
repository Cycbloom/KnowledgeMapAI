import { supabaseAdmin } from '../../supabase';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role?: 'admin' | 'user';
  settings?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileData {
  name?: string;
  settings?: Record<string, any>;
}

export class AuthService {
  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to fetch user profile:', error);
      throw new AppError('获取用户资料失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    return data as UserProfile;
  }

  async updateProfile(userId: string, updates: UpdateProfileData): Promise<UserProfile> {
    const updateData: Record<string, any> = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.settings !== undefined) updateData.settings = updates.settings;

    if (Object.keys(updateData).length === 0) {
      const existingProfile = await this.getProfile(userId);
      return existingProfile;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update user profile:', error);
      throw new AppError(error.message || '更新个人资料失败', 500, ErrorCodes.INTERNAL_ERROR);
    }

    return data as UserProfile;
  }
}

export const authService = new AuthService();
