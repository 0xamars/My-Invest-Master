import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { mergeSessionCookieOptions } from "@/lib/security/cookies";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                mergeSessionCookieOptions(options, process.env.NODE_ENV === "production"),
              ),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // handles session refresh.
          }
        },
      },
    },
  );
}
