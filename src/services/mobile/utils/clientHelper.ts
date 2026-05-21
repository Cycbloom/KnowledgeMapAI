import { getMobileSupabaseClient } from "@/lib/supabase";

type SupabaseClient = NonNullable<ReturnType<typeof getMobileSupabaseClient>>;

export const withClient = async <T>(
  fn: (client: SupabaseClient) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new Error("Supabase client not initialized");
  }
  return fn(client);
};

export const withClientAndUser = async <T>(
  fn: (client: SupabaseClient, userId: string) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new Error("Supabase client not initialized");
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  return fn(client, user.id);
};

export const withClientOptionalUser = async <T>(
  fn: (client: SupabaseClient, userId: string | null) => Promise<T>
): Promise<T> => {
  const client = getMobileSupabaseClient();
  if (!client) {
    throw new Error("Supabase client not initialized");
  }

  const { data: { user } } = await client.auth.getUser();
  return fn(client, user?.id ?? null);
};
