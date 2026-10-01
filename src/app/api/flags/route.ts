import { NextResponse } from "next/server";
import { resolvePublicFlags } from "@/lib/flags/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Resolved flags for the signed-in account. Signed-out callers get environment defaults. */
export async function GET() {
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  const flags = await resolvePublicFlags(userId);
  return NextResponse.json(
    { flags },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
