export interface User {
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

export interface UserWithoutPassword {
  id: string;
  email: string;
  name: string;
  plan?: 'free' | 'premium';
  settings?: Record<string, unknown>;
  xp?: number;
  level?: number;
  role?: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
}

export function excludePassword(user: User): UserWithoutPassword {
  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
