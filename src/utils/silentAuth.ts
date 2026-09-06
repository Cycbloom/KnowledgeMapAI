import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { bytesToBase64 } from './bytesToBase64';

/**
 * 无感知会话（专属用户）工具
 *
 * 应用为单用户本地工具：首次设置向导完成后自动创建一个专属用户，
 * 随机凭证保存在 localStorage，后续启动用凭证静默重登，用户全程无感知。
 */

const CREDENTIALS_KEY = 'km-owner-credentials';

interface OwnerCredentials {
  email: string;
  password: string;
}

const generateRandomPassword = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
};

const generateCredentials = (): OwnerCredentials => ({
  email: `owner-${crypto.randomUUID()}@local.app`,
  password: generateRandomPassword(),
});

export const getOwnerCredentials = (): OwnerCredentials | null => {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as OwnerCredentials).email === 'string' &&
      typeof (parsed as OwnerCredentials).password === 'string'
    ) {
      return parsed as OwnerCredentials;
    }
    return null;
  } catch {
    return null;
  }
};

export const saveOwnerCredentials = (credentials: OwnerCredentials): void => {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
};

export const clearOwnerCredentials = (): void => {
  localStorage.removeItem(CREDENTIALS_KEY);
};

/**
 * 开发期专属：把新创建的 owner 凭证同步到后端，由后端落盘到仓库根目录
 * `.dev-owner-credentials.json`。AI/Playwright 调试脚本随后用同一份凭证登录，
 * 即可看到真实数据。
 *
 * fire-and-forget 且内部吞错：仅受开发模式触发，且不因同步失败阻塞登录主流程。
 * 使用隔离 fetch 而非 api client，避免把 axios 拦截器（token 刷新/登录跳转）引入
 * 启动认证的早期路径。
 */
const syncOwnerCredentials = (credentials: OwnerCredentials): void => {
  let mode = "development";
  try {
    mode = (import.meta.env?.MODE as string | undefined) ?? "development";
  } catch {
    // import.meta 不可用时回退为开发模式判断
  }
  if (mode !== "development") return;

  void fetch("/api/v1/owner-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  }).catch(() => undefined);
};

/**
 * 创建专属用户并保存凭证到本地。
 *
 * signUp 在未开启邮箱确认时直接返回 session；若项目开启了邮箱确认
 * 或用户已存在，则回退 signInWithPassword 尝试登录。
 * 全部失败时返回 null（凭证不落盘，下次可重试）。
 */
export const provisionOwner = async (
  client: SupabaseClient,
): Promise<Session | null> => {
  const credentials = generateCredentials();

  const { data, error } = await client.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      // 友好默认显示名，避免界面回退显示 owner-<uuid> 邮箱前缀；
      // 用户可随时在个人资料页修改
      data: { name: 'Owner' },
    },
  });

  if (!error && data.session) {
    saveOwnerCredentials(credentials);
    syncOwnerCredentials(credentials);
    return data.session;
  }

  const { data: signInData } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (signInData.session) {
    saveOwnerCredentials(credentials);
    syncOwnerCredentials(credentials);
    return signInData.session;
  }

  return null;
};

/**
 * 启动时静默重登：读取本地凭证登录。
 * 登录失败（用户已被删除/密码失效）时清理死凭证，
 * 避免每次启动反复尝试永远无效的凭证，并让调用方能走到重新创建用户的兜底。
 */
export const silentSignIn = async (
  client: SupabaseClient,
): Promise<Session | null> => {
  const credentials = getOwnerCredentials();
  if (!credentials) return null;

  try {
    const { data } = await client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (data.session) return data.session;
  } catch {
    // 登录失败视为无有效会话
  }
  clearOwnerCredentials();
  return null;
};

/**
 * 构建模式判断：开发/测试环境返回 true。
 *
 * 决定会话恢复是否允许「自动创建专属用户」兜底：
 * - 开发/测试：保留 provisionOwner 自动建号，支撑本地开发与 AI 调试登录链路
 *   （webapp_login.py 依赖 syncOwnerCredentials 同步的 .dev-owner-credentials.json）。
 * - 生产（云端部署）：不自动建号，返回 null，由调用方引导显式注册/登录，
 *   保证手机/桌面/Web 共享同一账号同一数据。
 */
export function isDevelopmentMode(): boolean {
  try {
    const mode = import.meta.env?.MODE;
    return mode === "development" || mode === "test";
  } catch {
    // import.meta 不可用时回退为开发模式判断
    return true;
  }
}

/**
 * 统一的会话恢复流程（自愈）：
 *
 * 1. 校验本地缓存 session：JWT 可能仍有效但用户已被删除（僵尸 session），
 *    用 getUser 向服务端确认用户真实存在，失效则 signOut 清除本地缓存。
 * 2. 本地凭证静默重登：凭证失效时自动清理（见 silentSignIn）。
 * 3. 兜底：开发/测试环境创建新的专属用户；生产环境返回 null，
 *    由调用方（Login 页）展示显式登录表单。
 *
 * 数据库重置/用户被删除后，应用走完此链路即可无感恢复，不会卡死在旧凭证上。
 */
export const restoreSession = async (
  client: SupabaseClient,
): Promise<Session | null> => {
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session) {
    const { data: userData, error } = await client.auth.getUser(
      sessionData.session.access_token,
    );
    if (!error && userData.user) {
      return sessionData.session;
    }
    // 僵尸 session：用户已不存在，清除本地缓存的会话
    await client.auth.signOut();
  }

  const silentSession = await silentSignIn(client);
  if (silentSession) return silentSession;

  if (isDevelopmentMode()) {
    return provisionOwner(client);
  }
  return null;
};
