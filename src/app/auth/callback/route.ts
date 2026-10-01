import { NextResponse } from "next/server";
import { grantListedAdminOnSignIn } from "@/lib/admin/is-admin";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, safeAuthNextPath } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeAuthNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      try {
        await grantListedAdminOnSignIn(user);
      } catch {
        // The next signed-in request checks the allowlist again.
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=auth`);
}
