// @vitest-environment jsdom
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Register } from '../../pages/Register';
import { renderWithProviders } from '../../../tests/helpers/renderWithProviders';
import { useStore } from '../../store/useStore';
import { useThemeStore } from '../../store/useThemeStore';
import { userFactory } from '../../../tests/helpers/factories';
import type { AuthResponse } from '@shared/types/api';

// 导航 mock：通过闭包引用，实际调用时（渲染期间）已初始化
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// authApi mock：控制 register 返回值
vi.mock('../../services/api/auth', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getUser: vi.fn(),
    updateProfile: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

import { authApi } from '../../services/api/auth';

describe('Register 页面', () => {
  beforeEach(() => {
    // Targeted reset of only the stores Register uses.
    // Avoids resetStores() which throws on stores lacking partialize.
    useStore.setState(useStore.getInitialState());
    useThemeStore.setState(useThemeStore.getInitialState());
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('初始渲染', () => {
    it('应该显示姓名、邮箱、密码、确认密码输入框和注册按钮', () => {
      renderWithProviders(<Register />);

      expect(screen.getByLabelText(/^姓名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^邮箱/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^密码/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^确认密码/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument();
    });
  });

  describe('表单校验', () => {
    it('空表单提交时应该显示校验错误且不调用 authApi.register', async () => {
      renderWithProviders(<Register />);

      // Blur 邮箱字段以触发 React 校验（空值不通过邮箱格式校验）
      fireEvent.blur(screen.getByLabelText(/^邮箱/));

      await waitFor(() => {
        expect(screen.getByText('邮箱格式不正确')).toBeVisible();
      });

      // 提交空表单（必填字段为空，应被原生校验拦截）
      fireEvent.click(screen.getByRole('button', { name: '注册' }));

      await waitFor(() => {
        expect(authApi.register).not.toHaveBeenCalled();
      });
    });

    it('邮箱格式无效时应该显示校验错误且不调用 authApi.register', async () => {
      renderWithProviders(<Register />);

      const emailInput = screen.getByLabelText(/^邮箱/);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('邮箱格式不正确')).toBeVisible();
      });
      expect(authApi.register).not.toHaveBeenCalled();
    });

    it('密码过短时应该显示校验错误且不调用 authApi.register', async () => {
      renderWithProviders(<Register />);

      const passwordInput = screen.getByLabelText(/^密码/);
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('至少 8 个字符')).toBeVisible();
      });
      expect(authApi.register).not.toHaveBeenCalled();
    });

    it('两次密码不一致时应该显示校验错误且不调用 authApi.register', async () => {
      renderWithProviders(<Register />);

      const passwordInput = screen.getByLabelText(/^密码/);
      const confirmPasswordInput = screen.getByLabelText(/^确认密码/);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, {
        target: { value: 'password456' },
      });
      fireEvent.blur(confirmPasswordInput);

      await waitFor(() => {
        expect(screen.getByText('两次密码不一致')).toBeVisible();
      });
      expect(authApi.register).not.toHaveBeenCalled();
    });
  });

  describe('注册成功', () => {
    it('有效输入时应该调用 authApi.register 并跳转到首页', async () => {
      const mockUser = userFactory();
      vi.mocked(authApi.register).mockResolvedValue({
        user: mockUser,
        session: {
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-456',
          expires_in: 3600,
          token_type: 'bearer',
        },
      });

      renderWithProviders(<Register />);

      fireEvent.change(screen.getByLabelText(/^姓名/), {
        target: { value: '测试用户' },
      });
      fireEvent.change(screen.getByLabelText(/^邮箱/), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^密码/), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/^确认密码/), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '注册' }));

      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith({
          name: '测试用户',
          email: 'test@example.com',
          password: 'password123',
        });
      });
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('注册失败', () => {
    it('注册返回错误时应该显示错误信息且不跳转', async () => {
      const errorResponse: AuthResponse = {
        user: null,
        error: '该邮箱已被注册',
      };
      vi.mocked(authApi.register).mockResolvedValue(errorResponse);

      renderWithProviders(<Register />);

      fireEvent.change(screen.getByLabelText(/^姓名/), {
        target: { value: '测试用户' },
      });
      fireEvent.change(screen.getByLabelText(/^邮箱/), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^密码/), {
        target: { value: 'password123' },
      });
      fireEvent.change(screen.getByLabelText(/^确认密码/), {
        target: { value: 'password123' },
      });

      fireEvent.click(screen.getByRole('button', { name: '注册' }));

      await waitFor(() => {
        expect(screen.getByText('该邮箱已被注册')).toBeVisible();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
