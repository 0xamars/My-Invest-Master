import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/flags/server";
import { isPlaidConfigured, isPlaidStorageReady } from "@/lib/plaid/config";
import { isPlaidEncryptionReady } from "@/lib/plaid/crypto";
import { createClient } from "@/lib/supabase/server";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function requirePlaidUser(
  request: Request,
  options?: { requireBankFlag?: boolean },
) {
  const limited = rateLimitJsonResponse(request, "plaid", { max: 30 });
  if (limited) return { error: limited as Response };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  }
  if (options?.requireBankFlag !== false) {
    if (!(await isFeatureEnabled("bank_connect", user.id))) {
      return {
        error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      };
    }
  }
  return { user, supabase };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Keys, encryption key, and the service-role database. Null when ready.
 * The account flag is checked in requirePlaidUser, so disconnect can skip it.
 */
export function plaidSetupError(): Response | null {
  if (!isPlaidConfigured() || !isPlaidEncryptionReady()) {
    return jsonError("Bank linking is not set up on this server.", 503);
  }
  if (!isPlaidStorageReady()) {
    return jsonError("Bank linking needs a server database key.", 503);
  }
  return null;
}
