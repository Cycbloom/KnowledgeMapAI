// @vitest-environment jsdom
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../../tests/setup/mswServer";
import { Login } from "../../pages/Login";
import { renderWithProviders } from "../../../tests/helpers/renderWithProviders";
import { useStore } from "../../store/useStore";
import { useThemeStore } from "../../store/useThemeStore";

// 导航 mock：通过闭包引用，实际调用时（渲染期间）已初始化
const mockNavigate = vi.fn();

// Supabase client mock - 方法可在每个测试中覆盖
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("../../utils/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
  resetSupabaseClient: vi.fn(),
}));

// 用与 Login.tsx 相同的相对路径 mock authConfig，避免依赖 @/ 别名。
// @/ 别名在 vitest 的模块解析里未必与组件实际使用的相对 import 归一化成同一
// 模块 ID；若不归一化，mock 不会生效，组件会走真实 isSupabaseConfigured()
// （依赖 VITE_SUPABASE_URL 环境变量）。CI 无该环境变量时会返回 false，
// 导致 ensureOwnerSession 从未执行、三个 auth mock 都不被调用。
vi.mock("../../config/authConfig", async () => {
  const actual =
    await vi.importActual<typeof import("../../config/authConfig")>(
      "../../config/authConfig",
    );
  return {
    ...actual,
    isSupabaseConfigured: () => true,
    authConfig: {
      mode: "supabase" as const,
      isSupabase: () => true,
      supabase: {
        url: "https://test.supabase.co",
        anonKey: "test-anon-key",
      },
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Login 页面（无感知会话）", () => {
  beforeEach(() => {
    // 重置 Login 实际使用的 stores（避免 resetStores 对部分 store 抛错）
    useStore.setState(useStore.getInitialState());
    useThemeStore.setState(useThemeStore.getInitialState());
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    // 注册 MSW handlers 覆盖 Login 组件初始化（loadSavedConfig）调用的 API 端点。
    // 注意：不要 mock window.electronAPI，否则 isElectron() 返回 true
    // 导致 axios baseURL 从 /api/v1 变为 http://localhost:3001/api
    // 源组件使用可选链 window.electronAPI?.config，undefined 是安全的
    server.use(
      http.get("/api/v1/ai/config/database", () =>
        HttpResponse.json({}),
      ),
      http.get("/api/v1/database/status", () =>
        HttpResponse.json({ status: "ready" }),
      ),
      http.get("/api/v1/ai/config/providers", () =>
        HttpResponse.json({}),
      ),
      http.put("/api/v1/ai/config/database", () =>
        HttpResponse.json({}),
      ),
    );

    // 默认：无 session、本地无凭证（setupTests 的 localStorage stub 恒返回 null）
    // → 挂载时自动 ensureOwnerSession 走 provisionOwner 分支
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSignOut.mockResolvedValue({});
    mockSignUp.mockResolvedValue({ data: {}, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
  });

  it("Supabase 已配置时挂载即自动创建专属用户并进入首页", async () => {
    const mockUser = { id: "user-1", email: "owner@local.app" };
    mockSignUp.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token-123",
          refresh_token: "refresh-token-456",
          user: mockUser,
        },
      },
      error: null,
    });

    renderWithProviders(<Login />);

    await waitFor(
      () => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );
    // 随机凭证：邮箱为 owner-<uuid>@local.app 形式
    const signUpArg = mockSignUp.mock.calls[0]?.[0] as {
      email: string;
      password: string;
    };
    expect(signUpArg.email).toMatch(/^owner-.+@local\.app$/);
    expect(signUpArg.password.length).toBeGreaterThan(0);
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      },
      { timeout: 5000 },
    );
    expect(useStore.getState().user?.id).toBe("user-1");
  });

  it("已有有效会话时直接进入首页且不再创建用户", async () => {
    const mockUser = { id: "user-2", email: "owner@local.app" };
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token-existing",
          refresh_token: "refresh-token-existing",
          user: mockUser,
        },
      },
    });
    // restoreSession 用 getUser 校验服务端用户仍存在
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    renderWithProviders(<Login />);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      },
      { timeout: 5000 },
    );
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("会话恢复失败时展示显式登录表单且不跳转", async () => {
    // signUp 无 session 且 signInWithPassword 回退也失败 → restoreSession 返回 null → 需要显式登录
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "signups not allowed" },
    });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderWithProviders(<Login />);

    // 等待 provision 尝试完成（signUp + 回退 signIn 各一次）
    await waitFor(
      () => {
        expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 },
    );

    // 不再自动建号：展示显式登录表单（邮箱/密码），不跳转
    await waitFor(
      () => {
        expect(screen.getByLabelText("邮箱")).toBeVisible();
        expect(screen.getByLabelText("密码")).toBeVisible();
      },
      { timeout: 5000 },
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("显式登录成功后保存凭证并进入首页", async () => {
    // 先制造会话恢复失败 → 展示登录表单
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "signups not allowed" },
    });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderWithProviders(<Login />);

    await waitFor(
      () => {
        expect(screen.getByLabelText("邮箱")).toBeVisible();
      },
      { timeout: 5000 },
    );

    // 用户填写邮箱密码并提交
    const mockUser = { id: "user-login", email: "me@example.com" };
    mockSignInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: "access-login",
          refresh_token: "refresh-login",
          user: mockUser,
        },
        user: mockUser,
      },
      error: null,
    });

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "me@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      },
      { timeout: 5000 },
    );
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret123",
    });
    expect(useStore.getState().user?.id).toBe("user-login");
    // 凭证已保存到 localStorage（setItem 为 noop mock，断言调用参数）
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "km-owner-credentials",
      JSON.stringify({ email: "me@example.com", password: "secret123" }),
    );
  });
});
