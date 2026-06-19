import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes, type ErrorCode } from "../../../shared/types/errorCodes";

interface SignUpResult {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  session: unknown | null;
}

interface SignInResult {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  session: unknown;
}

interface RefreshResult {
  session: unknown;
  user: {
    id: string;
    email?: string;
  } | null;
}

class AuthRouteService {
  async signUp(
    admin: SupabaseClient,
    email: string,
    password: string,
    name: string,
  ): Promise<SignUpResult> {
    const { data, error } = await admin.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      const errorMap: Record<string, ErrorCode> = {
        'user_already_exists': ErrorCodes.EMAIL_ALREADY_EXISTS,
        'email_address_invalid': ErrorCodes.INVALID_EMAIL,
        'invalid_password': ErrorCodes.PASSWORD_REQUIREMENTS,
        'weak_password': ErrorCodes.WEAK_PASSWORD,
        'signup_disabled': ErrorCodes.SIGNUP_DISABLED,
      };

      const supabaseErrorCode = (error as unknown as Record<string, unknown>).code as string || '';
      const errorCode = errorMap[supabaseErrorCode];

      if (errorCode) {
        throw new AppError(errorCode);
      }

      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS);
      }

      if (error.message.includes('password')) {
        throw new AppError(ErrorCodes.PASSWORD_REQUIREMENTS);
      }

      throw new AppError(ErrorCodes.REGISTER_FAILED);
    }

    if (!data.user) {
      throw new AppError('创建用户失败，请稍后重试', 500, ErrorCodes.INTERNAL_ERROR);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signInWithPassword(
    admin: SupabaseClient,
    email: string,
    password: string,
  ): Promise<SignInResult> {
    const { data, error } = await admin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const errorMap: Record<string, ErrorCode> = {
        'invalid_credentials': ErrorCodes.INVALID_CREDENTIALS,
        'invalid_login_credentials': ErrorCodes.INVALID_CREDENTIALS,
        'email_not_confirmed': ErrorCodes.EMAIL_NOT_CONFIRMED,
        'too_many_requests': ErrorCodes.TOO_MANY_REQUESTS,
        'user_not_found': ErrorCodes.USER_NOT_FOUND,
        'invalid_password': ErrorCodes.INVALID_CREDENTIALS,
        'sign_in_not_allowed': ErrorCodes.AUTH_FORBIDDEN,
      };

      const supabaseErrorCode = (error as unknown as Record<string, unknown>).code as string || '';
      const errorCode = errorMap[supabaseErrorCode] || ErrorCodes.LOGIN_FAILED;

      throw new AppError(errorCode);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async refreshSession(
    admin: SupabaseClient,
    refreshToken: string,
  ): Promise<RefreshResult> {
    const { data, error } = await admin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new AppError(ErrorCodes.TOKEN_REFRESH_EXPIRED);
    }

    if (!data.session) {
      throw new AppError(ErrorCodes.SESSION_REFRESH_FAILED);
    }

    return {
      session: data.session,
      user: data.user,
    };
  }

  async signOut(
    admin: SupabaseClient,
    userId: string,
  ): Promise<void> {
    const { error } = await admin.auth.admin.signOut(userId);

    if (error) {
      throw new AppError(ErrorCodes.LOGOUT_FAILED);
    }
  }

  async createUserProfile(
    admin: SupabaseClient,
    userId: string,
    email: string,
    name: string,
  ): Promise<void> {
    const { error } = await admin.from("users").insert([
      {
        id: userId,
        email,
        name,
        password_hash: "MANAGED_BY_SUPABASE_AUTH",
      },
    ]);

    if (error) {
      logger.warn("Failed to create user profile, may already exist", {
        userId,
        error,
      });
    }
  }

  async ensureUserProfile(
    admin: SupabaseClient,
    userId: string,
    email: string,
    name: string,
  ): Promise<void> {
    const { data: existingProfile } = await admin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      logger.info("Repairing missing public profile for user", { userId });
      await this.createUserProfile(admin, userId, email, name);
    }
  }
}

export const authRouteService = new AuthRouteService();
