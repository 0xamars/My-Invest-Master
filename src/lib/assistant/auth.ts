import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AssistantAuthResult {
  ok: boolean;
  userId: string | null;
  /** When false, cloud auth is disabled for this deployment. */
  authRequired: boolean;
  error?: string;
}

/**
 * Require a signed-in Supabase user when auth is configured.
 * Local/dev deployments without Supabase remain usable.
 */
export async function requireAssistantAuth(): Promise<AssistantAuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, userId: null, authRequired: false };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        userId: null,
        authRequired: true,
        error: "Sign in to use the InvestSalsa assistant.",
      };
    }

    return { ok: true, userId: user.id, authRequired: true };
  } catch {
    return {
      ok: false,
      userId: null,
      authRequired: true,
      error: "Unable to verify your session. Please sign in again.",
    };
  }
}
