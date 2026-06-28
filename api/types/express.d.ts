import 'express';
import { type SupabaseClient, type User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      // 注意：受 requireAuth 保护的路由中 user/supabase 一定存在；optionalAuth 路由中可能不存在。
      // 全局声明为非可选以避免 requireAuth 路由的海量类型修正；optionalAuth 路由 handler
      // 必须使用 req.user?.id / req.supabase! 形式防御性访问（与原设计保持一致）。
      user: User;
      supabase: SupabaseClient;
    }
  }
}
