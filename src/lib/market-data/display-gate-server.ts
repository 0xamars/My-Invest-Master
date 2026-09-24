import { NextResponse } from "next/server";
import {
  FMP_DISPLAY_UNAVAILABLE,
  fmpDisplayAllowsEmail,
  isFmpDisplayGateEnabled,
  parseFmpDisplayAllowlist,
} from "@/lib/market-data/display-gate";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function readSignedInIdentity(): Promise<{
  email: string | null;
  emailConfirmed: boolean;
}> {
  if (!isSupabaseConfigured()) return { email: null, emailConfirmed: false };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return {
      email: user?.email ?? null,
      emailConfirmed: Boolean(user?.email_confirmed_at),
    };
  } catch {
    return { email: null, emailConfirmed: false };
  }
}

/**
 * Gate off: allow, without reading the session.
 * Gate on: allow only a signed-in allowlisted email with
 * `email_confirmed_at` set. An unconfirmed signup is denied.
 * If auth is not configured, a turned-on gate denies everyone.
 */
export async function isFmpDisplayAllowed(): Promise<boolean> {
  if (!isFmpDisplayGateEnabled()) return true;
  const identity = await readSignedInIdentity();
  return fmpDisplayAllowsEmail(identity.email, {
    enabled: true,
    allowlist: parseFmpDisplayAllowlist(process.env.FMP_DISPLAY_ALLOWED_EMAILS),
    emailConfirmed: identity.emailConfirmed,
  });
}

/**
 * `null` when the caller should continue and may call FMP.
 * Otherwise a 403 that keeps the caller's body and sets `error`.
 */
export async function fmpDisplayDeniedResponse(
  body: Record<string, unknown>,
): Promise<NextResponse | null> {
  if (await isFmpDisplayAllowed()) return null;
  const response = NextResponse.json(
    { ...body, error: FMP_DISPLAY_UNAVAILABLE },
    { status: 403 },
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
