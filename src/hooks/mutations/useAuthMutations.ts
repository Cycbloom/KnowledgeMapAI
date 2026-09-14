import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../services/api/auth";
import type {
  LoginData,
  RegisterData,
  UpdateProfileData,
} from "@shared/types/api";
import { useStore } from "../../store/useStore";
import { queryKeys } from "../queries/config";
import { clearOwnerCredentials } from "../../utils/silentAuth";

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
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // 清理持久化的专属用户凭证，否则下次启动 silentSignIn 会用残留凭证静默重登，
      // 造成「退出登录后仍自动登录」的假象。
      clearOwnerCredentials();
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
