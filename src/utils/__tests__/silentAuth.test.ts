// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  getOwnerCredentials,
  saveOwnerCredentials,
  clearOwnerCredentials,
  provisionOwner,
  silentSignIn,
  restoreSession,
} from '../silentAuth';

// 全局 setupTests 将 window.localStorage mock 为恒返回 null，
// 此处用内存实现覆盖以验证真实的读写/清除行为。
const makeLocalStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

beforeAll(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const makeSession = (email: string): Session =>
  ({
    access_token: `access-${email}`,
    refresh_token: `refresh-${email}`,
    user: { id: `id-${email}`, email },
  }) as unknown as Session;

const makeClient = (overrides?: {
  signUp?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  getSession?: ReturnType<typeof vi.fn>;
  getUser?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
}): SupabaseClient =>
  ({
    auth: {
      signUp: overrides?.signUp ?? vi.fn(),
      signInWithPassword: overrides?.signInWithPassword ?? vi.fn(),
      getSession: overrides?.getSession ?? vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: overrides?.getUser ?? vi.fn(),
      signOut: overrides?.signOut ?? vi.fn().mockResolvedValue({}),
    },
  }) as unknown as SupabaseClient;

describe('owner credentials storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips credentials through localStorage', () => {
    expect(getOwnerCredentials()).toBeNull();

    saveOwnerCredentials({ email: 'owner@local.app', password: 'p@ss' });
    expect(getOwnerCredentials()).toEqual({
      email: 'owner@local.app',
      password: 'p@ss',
    });

    clearOwnerCredentials();
    expect(getOwnerCredentials()).toBeNull();
  });

  it('returns null for corrupted or malformed stored values', () => {
    localStorage.setItem('km-owner-credentials', '{not json');
    expect(getOwnerCredentials()).toBeNull();

    localStorage.setItem('km-owner-credentials', JSON.stringify({ email: 1 }));
    expect(getOwnerCredentials()).toBeNull();
  });
});

describe('provisionOwner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('signs up and persists credentials when session is returned directly', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: makeSession('owner-a@local.app') },
      error: null,
    });
    const client = makeClient({ signUp });

    const session = await provisionOwner(client);

    expect(session?.user?.email).toBe('owner-a@local.app');
    expect(signUp).toHaveBeenCalledTimes(1);
    const credentials = getOwnerCredentials();
    expect(credentials).not.toBeNull();
    expect(signUp.mock.calls[0]?.[0]).toEqual({
      email: credentials?.email,
      password: credentials?.password,
      options: { data: { name: 'Owner' } },
    });
  });

  it('falls back to password sign-in when signUp returns no session', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const signIn = vi.fn().mockResolvedValue({
      data: { session: makeSession('owner-b@local.app') },
    });
    const client = makeClient({ signUp, signInWithPassword: signIn });

    const session = await provisionOwner(client);

    expect(session?.user?.email).toBe('owner-b@local.app');
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(getOwnerCredentials()).not.toBeNull();
  });

  it('returns null and does not persist credentials when both attempts fail', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'signup disabled' },
    });
    const signIn = vi.fn().mockResolvedValue({ data: { session: null } });
    const client = makeClient({ signUp, signInWithPassword: signIn });

    const session = await provisionOwner(client);

    expect(session).toBeNull();
    expect(getOwnerCredentials()).toBeNull();
  });
});

describe('silentSignIn', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null without contacting auth when no credentials are stored', async () => {
    const signIn = vi.fn();
    const client = makeClient({ signInWithPassword: signIn });

    const session = await silentSignIn(client);

    expect(session).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('returns the session on successful silent sign-in', async () => {
    saveOwnerCredentials({ email: 'owner-c@local.app', password: 'p@ss' });
    const signIn = vi.fn().mockResolvedValue({
      data: { session: makeSession('owner-c@local.app') },
    });
    const client = makeClient({ signInWithPassword: signIn });

    const session = await silentSignIn(client);

    expect(session?.user?.email).toBe('owner-c@local.app');
    expect(signIn).toHaveBeenCalledWith({
      email: 'owner-c@local.app',
      password: 'p@ss',
    });
  });

  it('returns null when sign-in throws or yields no session', async () => {
    saveOwnerCredentials({ email: 'owner-d@local.app', password: 'bad' });

    const throwing = makeClient({
      signInWithPassword: vi.fn().mockRejectedValue(new Error('auth down')),
    });
    expect(await silentSignIn(throwing)).toBeNull();

    const empty = makeClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null } }),
    });
    expect(await silentSignIn(empty)).toBeNull();
  });

  it('clears dead credentials when sign-in fails so later runs can re-provision', async () => {
    saveOwnerCredentials({ email: 'owner-dead@local.app', password: 'bad' });
    const signIn = vi.fn().mockResolvedValue({ data: { session: null } });

    await silentSignIn(makeClient({ signInWithPassword: signIn }));

    expect(getOwnerCredentials()).toBeNull();
  });
});

describe('restoreSession（自愈链路）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns cached session when the user still exists server-side', async () => {
    const session = makeSession('owner-live@local.app');
    const getSession = vi.fn().mockResolvedValue({ data: { session } });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: session.user },
      error: null,
    });
    const client = makeClient({ getSession, getUser });

    const restored = await restoreSession(client);

    expect(restored?.user?.email).toBe('owner-live@local.app');
  });

  it('signs out a zombie session (user deleted) and falls through to re-provision', async () => {
    const zombieSession = makeSession('owner-zombie@local.app');
    const getSession = vi.fn().mockResolvedValue({ data: { session: zombieSession } });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'User from sub not found' },
    });
    const signOut = vi.fn().mockResolvedValue({});
    const signUp = vi.fn().mockResolvedValue({
      data: { session: makeSession('owner-new@local.app') },
      error: null,
    });
    const client = makeClient({ getSession, getUser, signOut, signUp });

    const restored = await restoreSession(client);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(restored?.user?.email).toBe('owner-new@local.app');
    expect(getOwnerCredentials()?.email).toMatch(/^owner-.+@local\.app$/);
  });

  it('drops dead local credentials and re-provisions when no cached session exists', async () => {
    saveOwnerCredentials({ email: 'owner-gone@local.app', password: 'bad' });
    const signIn = vi.fn().mockResolvedValue({ data: { session: null } });
    const signUp = vi.fn().mockResolvedValue({
      data: { session: makeSession('owner-fresh@local.app') },
      error: null,
    });
    const client = makeClient({ signInWithPassword: signIn, signUp });

    const restored = await restoreSession(client);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(restored?.user?.email).toBe('owner-fresh@local.app');
  });
});

describe('restoreSession（生产模式：不自动建号）', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('MODE', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('无缓存会话且无本地凭证时返回 null 且不调用 signUp', async () => {
    const signUp = vi.fn();
    const signIn = vi.fn();
    const client = makeClient({ signUp, signInWithPassword: signIn });

    const restored = await restoreSession(client);

    expect(restored).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('清理僵尸会话后不自动重建账号，返回 null', async () => {
    const zombieSession = makeSession('owner-zombie@local.app');
    const getSession = vi.fn().mockResolvedValue({ data: { session: zombieSession } });
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'User from sub not found' },
    });
    const signOut = vi.fn().mockResolvedValue({});
    const signUp = vi.fn();
    const client = makeClient({ getSession, getUser, signOut, signUp });

    const restored = await restoreSession(client);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(restored).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('本地凭证失效被清理后返回 null，交由登录表单引导显式登录', async () => {
    saveOwnerCredentials({ email: 'owner-dead@local.app', password: 'bad' });
    const signIn = vi.fn().mockResolvedValue({ data: { session: null } });
    const signUp = vi.fn();
    const client = makeClient({ signInWithPassword: signIn, signUp });

    const restored = await restoreSession(client);

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(getOwnerCredentials()).toBeNull();
    expect(restored).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });
});
