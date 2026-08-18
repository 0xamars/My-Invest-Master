import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { mergeSessionCookieOptions } from "@/lib/security/cookies";
import { isProtectedRoute } from "@/lib/security/protected-routes";
import {
  APP_HOME_PATH,
  LOGIN_PATH,
  SIGNIN_PATH,
  SIGNUP_PATH,
  safeAuthNextPath,
} from "@/lib/routes";
import type { Database } from "@/types/database";

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const isHttps = request.nextUrl.protocol === "https:";

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              mergeSessionCookieOptions(options, isHttps),
            ),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const signinQuery = request.nextUrl.searchParams.get("signin");

  if (pathname === "/" && signinQuery === "1") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.delete("signin");
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === SIGNIN_PATH) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = user ? APP_HOME_PATH : LOGIN_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === LOGIN_PATH || pathname === SIGNUP_PATH)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_HOME_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", safeAuthNextPath(pathname));
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export { isProtectedRoute };
