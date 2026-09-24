import { NextResponse } from "next/server";
import {
  FMP_DISPLAY_UNAVAILABLE,
  fmpDisplayAllowsEmail,
  isFmpDisplayGateEnabled,
  parseFmpDisplayAllowlist,
} from "@/lib/market-data/display-gate";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function readSignedInEmail(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Gate off: allow, without reading the session.
 * Gate on: allow only a signed-in allowlisted email.
 * If auth is not configured, a turned-on gate denies everyone.
 */
export async function isFmpDisplayAllowed(): Promise<boolean> {
  if (!isFmpDisplayGateEnabled()) return true;
  const email = await readSignedInEmail();
  return fmpDisplayAllowsEmail(email, {
    enabled: true,
    allowlist: parseFmpDisplayAllowlist(process.env.FMP_DISPLAY_ALLOWED_EMAILS),
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
