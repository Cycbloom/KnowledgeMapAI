import type { User } from "../../shared/types/user";

// DB 风格用户（含密码哈希等凭证字段）。独立定义，不 extends shared.User，
// 因 shared.User.name 为可选、此处为必填，直接 extends 会产生类型冲突。
// 二者通过下方 toUser 转换函数桥接。
export interface UserWithCredentials {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  plan?: 'free' | 'premium';
  settings?: Record<string, unknown>;
  xp?: number;
  level?: number;
  role?: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}

export interface UpdateUserInput {
  name?: string;
  settings?: Record<string, unknown>;
}

export type UserWithoutPassword = Omit<UserWithCredentials, 'password_hash'>;

export function excludePassword(user: UserWithCredentials): UserWithoutPassword {
  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// 将 DB 风格用户转换为 shared.User（Supabase Auth 风格，供前端/API 响应使用）
export function toUser(user: UserWithCredentials): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
