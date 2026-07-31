import { getMobileSupabaseClient } from "@/utils/supabase";
import { AppError, SharedErrorCodes } from "@/utils/errors";

type MobileSupabaseClient = NonNullable<ReturnType<typeof getMobileSupabaseClient>>;

export const withClient = async <T>(
  fn: (client: MobileSupabaseClient) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
  }
  return fn(client);
};

export const withClientAndUser = async <T>(
  fn: (client: MobileSupabaseClient, userId: string) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new AppError("User not authenticated", SharedErrorCodes.AUTH_UNAUTHORIZED, 401);
  }

  return fn(client, user.id);
};

export const withClientOptionalUser = async <T>(
  fn: (client: MobileSupabaseClient, userId: string | null) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
  }

  const { data: { user } } = await client.auth.getUser();
  return fn(client, user?.id ?? null);
};

export type { MobileSupabaseClient };
