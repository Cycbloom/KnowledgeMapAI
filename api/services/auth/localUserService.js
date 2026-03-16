import { excludePassword } from '../../models/user.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function now() {
    return new Date().toISOString();
}
function parseUser(row) {
    return {
        id: row.id,
        email: row.email,
        password_hash: row.password_hash,
        name: row.name,
        plan: row.plan,
        settings: row.settings ? JSON.parse(row.settings) : {},
        xp: row.xp,
        level: row.level,
        role: row.role,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
export class LocalUserService {
    db = null;
    setDatabase(db) {
        this.db = db;
    }
    getDb() {
        if (!this.db) {
            throw new AppError('Database not initialized', 500, ErrorCodes.INTERNAL_ERROR);
        }
        return this.db;
    }
    async findByEmail(email) {
        try {
            const db = this.getDb();
            const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            return row ? parseUser(row) : null;
        }
        catch (error) {
            logger.error('Failed to find user by email', { error, email });
            throw new AppError('Failed to find user', 500, ErrorCodes.INTERNAL_ERROR);
        }
    }
    async findById(id) {
        try {
            const db = this.getDb();
            const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
            return row ? parseUser(row) : null;
        }
        catch (error) {
            logger.error('Failed to find user by id', { error, id });
            throw new AppError('Failed to find user', 500, ErrorCodes.INTERNAL_ERROR);
        }
    }
    async create(input, hashedPassword) {
        try {
            const db = this.getDb();
            const id = generateUUID();
            const timestamp = now();
            db.prepare(`
        INSERT INTO users (id, email, password_hash, name, plan, settings, xp, level, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, input.email.toLowerCase(), hashedPassword, input.name, 'free', '{}', 0, 1, 'user', timestamp, timestamp);
            const user = await this.findById(id);
            if (!user) {
                throw new AppError('Failed to create user', 500, ErrorCodes.INTERNAL_ERROR);
            }
            return user;
        }
        catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
                throw new AppError('该邮箱已被注册', 409, ErrorCodes.VALIDATION_ERROR);
            }
            logger.error('Failed to create user', { error, email: input.email });
            throw new AppError('Failed to create user', 500, ErrorCodes.INTERNAL_ERROR);
        }
    }
    async update(id, input) {
        try {
            const db = this.getDb();
            const updates = [];
            const values = [];
            if (input.name !== undefined) {
                updates.push('name = ?');
                values.push(input.name);
            }
            if (input.settings !== undefined) {
                updates.push('settings = ?');
                values.push(JSON.stringify(input.settings));
            }
            if (updates.length === 0) {
                const user = await this.findById(id);
                if (!user) {
                    throw new AppError('用户不存在', 404, ErrorCodes.RESOURCE_USER_NOT_FOUND);
                }
                return user;
            }
            updates.push('updated_at = ?');
            values.push(now());
            values.push(id);
            db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
            const user = await this.findById(id);
            if (!user) {
                throw new AppError('用户不存在', 404, ErrorCodes.RESOURCE_USER_NOT_FOUND);
            }
            return user;
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error('Failed to update user', { error, id });
            throw new AppError('Failed to update user', 500, ErrorCodes.INTERNAL_ERROR);
        }
    }
    async getProfile(id) {
        const user = await this.findById(id);
        if (!user) {
            throw new AppError('用户不存在', 404, ErrorCodes.RESOURCE_USER_NOT_FOUND);
        }
        return excludePassword(user);
    }
}
export const localUserService = new LocalUserService();
//# sourceMappingURL=localUserService.js.map