// @vitest-environment jsdom
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Login } from "../../pages/Login";
import { renderWithProviders } from "../../../tests/helpers/renderWithProviders";
import { useStore } from "../../store/useStore";
import { useThemeStore } from "../../store/useThemeStore";

// 导航 mock：通过闭包引用，实际调用时（渲染期间）已初始化
const mockNavigate = vi.fn();

// Supabase client mock - 方法可在每个测试中覆盖
const mockGetSession = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();

vi.mock("@/utils/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
  resetSupabaseClient: vi.fn(),
}));

vi.mock("@/config/authConfig", async () => {
  const actual =
    await vi.importActual<typeof import("@/config/authConfig")>(
      "@/config/authConfig",
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

vi.mock("@/services/api/createApiClient", () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes("/database/status")) {
        return Promise.resolve({ status: "ready" });
      }
      return Promise.resolve({});
    }),
    put: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  },
}));

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

// 显示 auth 表单辅助函数：
// 切换到 manual tab → 填写 URL/anonKey → 点击测试连接 → 等待 auth 表单出现
async function showAuthForm(): Promise<void> {
  // 切换到手动设置 tab
  await act(async () => {
    fireEvent.click(screen.getByText("手动设置"));
  });

  // 等待初始 loadSavedConfig 完成（dbConnected=true 后显示"已连接"徽章）
  await waitFor(() => {
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  // 填写 URL 和 Anon Key（确保 handleTestConnection 校验通过）
  fireEvent.change(screen.getByPlaceholderText("https://xxx.supabase.co"), {
    target: { value: "https://test.supabase.co" },
  });
  fireEvent.change(screen.getByLabelText("Anon Key"), {
    target: { value: "test-anon-key" },
  });

  // 点击测试连接按钮，触发 attemptAutoAuth → setShowAuthForm(true)
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
  });

  // 等待 auth 表单出现
  await waitFor(() => {
    expect(
      screen.getByText("需要登录才能继续，请注册或登录。"),
    ).toBeInTheDocument();
  });
}

describe("Login 页面", () => {
  beforeEach(() => {
    // 重置 Login 实际使用的 stores（避免 resetStores 对部分 store 抛错）
    useStore.setState(useStore.getInitialState());
    useThemeStore.setState(useThemeStore.getInitialState());
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    // 默认：getSession 返回无 session，signInAnonymously 失败
    // → 触发 attemptAutoAuth 调用 setShowAuthForm(true)
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInAnonymously.mockResolvedValue({
      data: {},
      error: { message: "Anonymous sign-in not enabled" },
    });
    // 默认 signUp/signInWithPassword 占位（每个测试可覆盖）
    mockSignUp.mockResolvedValue({ data: {}, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
  });

  describe("初始渲染", () => {
    it("应该显示邮箱输入框、密码输入框和登录按钮", async () => {
      renderWithProviders(<Login />);
      await showAuthForm();

      expect(screen.getByPlaceholderText("邮箱")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("密码")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "登录" }),
      ).toBeInTheDocument();
    });
  });

  describe("表单校验", () => {
    it("空提交时应该显示校验错误且不调用 supabase auth", async () => {
      renderWithProviders(<Login />);
      await showAuthForm();

      // 提交空表单
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "登录" }));
      });

      await waitFor(() => {
        expect(screen.getByText("请输入邮箱")).toBeVisible();
      });
      expect(screen.getByText("请输入密码")).toBeVisible();
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it("邮箱格式无效时应该显示校验错误且不调用 supabase auth", async () => {
      renderWithProviders(<Login />);
      await showAuthForm();

      const emailInput = screen.getByPlaceholderText("邮箱");
      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.blur(emailInput);

      // 填写密码以通过非空校验
      fireEvent.change(screen.getByPlaceholderText("密码"), {
        target: { value: "password123" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "登录" }));
      });

      await waitFor(() => {
        expect(screen.getByText("邮箱格式不正确")).toBeVisible();
      });
      expect(mockSignUp).not.toHaveBeenCalled();
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe("登录成功", () => {
    it("有效凭证时应该调用 supabase auth 并跳转到首页", async () => {
      const mockUser = { id: "user-1", email: "test@example.com" };
      const mockSession = {
        access_token: "access-token-123",
        refresh_token: "refresh-token-456",
        expires_in: 3600,
        token_type: "bearer",
        user: mockUser,
      };
      // signUp 返回 error（用户已存在），signInWithPassword 返回成功 session
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      renderWithProviders(<Login />);
      await showAuthForm();

      fireEvent.change(screen.getByPlaceholderText("邮箱"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("密码"), {
        target: { value: "password123" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "登录" }));
      });

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });
  });

  describe("登录失败", () => {
    it("supabase auth 返回错误时应该显示错误信息且不跳转", async () => {
      // signUp 返回 error，signInWithPassword 也返回 error
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: "User already registered" },
      });
      mockSignInWithPassword.mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials" },
      });

      renderWithProviders(<Login />);
      await showAuthForm();

      fireEvent.change(screen.getByPlaceholderText("邮箱"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("密码"), {
        target: { value: "wrongpassword" },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "登录" }));
      });

      await waitFor(() => {
        expect(screen.getByText("Invalid login credentials")).toBeVisible();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
