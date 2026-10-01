import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { AdminServiceError } from "@/lib/admin/service";
import { isAdmin } from "@/lib/admin/is-admin";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export function adminNotFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Signed-in admin, or a 404 that does not reveal this route. */
export async function requireAdmin(
  request: Request,
): Promise<{ user: User } | { response: NextResponse }> {
  if (!isSupabaseConfigured()) return { response: adminNotFound() };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user))) return { response: adminNotFound() };

  const limited = rateLimitJsonResponse(request, `admin:${user.id}`, {
    max: 60,
  });
  if (limited) return { response: limited as NextResponse };
  return { user };
}

export function adminErrorResponse(error: unknown): NextResponse {
  if (error instanceof AdminServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return NextResponse.json(
    { error: "Something went wrong." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}
