import type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from "@shared/types/api";
import type { User } from "@shared/types/user";

export interface IAuthApi {
  register(data: RegisterData): Promise<AuthResponse>;
  login(data: LoginData): Promise<AuthResponse>;
  logout(): Promise<{ message: string }>;
  getUser(): Promise<{ user: User | null }>;
  updateProfile(data: UpdateProfileData): Promise<{ user: User | null }>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
}