import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedAdmin: SupabaseClient | null | undefined;

/**
 * Service-role Supabase client for server-managed market-data warehouse.
 * Singleton per process — never import from client components.
 */
export function createAdminClient(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cachedAdmin = null;
    return null;
  }

  cachedAdmin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedAdmin;
}

export function isMarketWarehouseConfigured(): boolean {
  return createAdminClient() != null;
}

/** Test helper — clear singleton between tests. */
export function resetAdminClientForTests(): void {
  cachedAdmin = undefined;
}
