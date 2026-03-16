import { supabaseAdmin } from '../../supabase.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
export class AuthService {
    async getProfile(userId) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) {
            logger.error('Failed to fetch user profile:', error);
            throw new AppError('获取用户资料失败', 500, ErrorCodes.INTERNAL_ERROR);
        }
        return data;
    }
    async updateProfile(userId, updates) {
        const updateData = {};
        if (updates.name !== undefined)
            updateData.name = updates.name;
        if (updates.settings !== undefined)
            updateData.settings = updates.settings;
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
        return data;
    }
}
export const authService = new AuthService();
//# sourceMappingURL=authService.js.map