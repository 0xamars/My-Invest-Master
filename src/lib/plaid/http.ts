import { NextResponse } from "next/server";
import { isPlaidEncryptionReady } from "@/lib/plaid/crypto";
import { isPlaidConfigured, isPlaidStorageReady } from "@/lib/plaid/config";
import { isBankConnectEnabled } from "@/lib/plaid/feature";
import { createClient } from "@/lib/supabase/server";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export async function requirePlaidUser(request: Request) {
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
  return { user, supabase };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Flag, keys, encryption key, and the service-role database. Null when ready. */
export function plaidSetupError(): Response | null {
  if (!isBankConnectEnabled()) {
    return jsonError("Bank connection is not available.", 404);
  }
  if (!isPlaidConfigured() || !isPlaidEncryptionReady()) {
    return jsonError("Bank linking is not set up on this server.", 503);
  }
  if (!isPlaidStorageReady()) {
    return jsonError("Bank linking needs a server database key.", 503);
  }
  return null;
}
