import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../services/api/auth";
import type {
  LoginData,
  RegisterData,
  UpdateProfileData,
} from "@shared/types/api";
import { useStore } from "../../store/useStore";
import { queryKeys } from "../queries/config";
import { clearOwnerCredentials, markSignedOut } from "../../utils/silentAuth";

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginData) => authApi.login(data),
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(queryKeys.user, { user: data.user });
      }
    },
  });
};

export const useRegisterMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data),
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(queryKeys.user, { user: data.user });
      }
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await authApi.logout();
      } finally {
        // 无论登出请求成功与否，都切断「自动重登」链路：
        // 清除本地凭证并置已退出标记，保证退出后刷新/重启不会自动登录。
        clearOwnerCredentials();
        markSignedOut();
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.user, null);
      queryClient.clear();
    },
  });
};

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileData) => authApi.updateProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.user });

      const { setUser, token } = useStore.getState();
      if (data.user) {
        setUser(data.user, token);
      }
    },
  });
};

export const useRefreshTokenMutation = () => {
  return useMutation({
    mutationFn: (refreshToken: string) => authApi.refreshToken(refreshToken),
  });
};
