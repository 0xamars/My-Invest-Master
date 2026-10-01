import { NextResponse } from "next/server";
import { readFlagOverride } from "@/lib/flags/overrides";
import {
  FMP_DISPLAY_UNAVAILABLE,
  fmpDisplayAllowsEmail,
  isFmpDisplayGateEnabled,
  parseFmpDisplayAllowlist,
} from "@/lib/market-data/display-gate";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function readSignedInIdentity(): Promise<{
  userId: string | null;
  email: string | null;
  emailConfirmed: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { userId: null, email: null, emailConfirmed: false };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return {
      userId: user?.id ?? null,
      email: user?.email ?? null,
      emailConfirmed: Boolean(user?.email_confirmed_at),
    };
  } catch {
    return { userId: null, email: null, emailConfirmed: false };
  }
}

/**
 * Gate off: allow, without reading the session or overrides.
 * Gate on: allow a confirmed allowlisted email, or a confirmed account
 * whose fmp_display override is on. An override of off denies the account.
 * An unconfirmed signup is denied. If auth is not configured, a turned-on
 * gate denies everyone.
 */
export async function isFmpDisplayAllowed(): Promise<boolean> {
  if (!isFmpDisplayGateEnabled()) return true;
  const identity = await readSignedInIdentity();
  const userOverride = identity.userId
    ? await readFlagOverride(identity.userId, "fmp_display")
    : null;
  return fmpDisplayAllowsEmail(identity.email, {
    enabled: true,
    allowlist: parseFmpDisplayAllowlist(process.env.FMP_DISPLAY_ALLOWED_EMAILS),
    emailConfirmed: identity.emailConfirmed,
    userOverride,
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
