import { NextResponse } from "next/server";
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
