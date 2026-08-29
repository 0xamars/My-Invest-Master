import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  moneyProfilePresenceFromQuery,
  shouldRedirectSignedInFromMarketing,
  shouldRedirectToMoneyProfile,
  signedInAuthRedirectPath,
  signedInLandingPath,
} from "@/lib/journey/landing";
import { mergeSessionCookieOptions } from "@/lib/security/cookies";
import { isProtectedRoute } from "@/lib/security/protected-routes";
import {
  LOGIN_PATH,
  MONEY_PROFILE_PATH,
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

function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  pathname: string,
  search = "",
): NextResponse {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  redirectUrl.search = search;
  const redirect = NextResponse.redirect(redirectUrl);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value);
  });
  return redirect;
}

async function userHasMoneyProfile(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_money_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return moneyProfilePresenceFromQuery({ data, error });
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
    if (!user) {
      return redirectWithSession(request, supabaseResponse, LOGIN_PATH);
    }
    const hasProfile = await userHasMoneyProfile(supabase, user.id);
    return redirectWithSession(
      request,
      supabaseResponse,
      signedInAuthRedirectPath(hasProfile),
    );
  }

  if (user && (pathname === LOGIN_PATH || pathname === SIGNUP_PATH)) {
    const hasProfile = await userHasMoneyProfile(supabase, user.id);
    return redirectWithSession(
      request,
      supabaseResponse,
      signedInAuthRedirectPath(hasProfile),
    );
  }

  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", safeAuthNextPath(pathname));
    const redirect = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    return redirect;
  }

  if (
    user &&
    shouldRedirectSignedInFromMarketing({
      signedIn: true,
      pathname,
    })
  ) {
    const hasProfile = await userHasMoneyProfile(supabase, user.id);
    return redirectWithSession(
      request,
      supabaseResponse,
      signedInLandingPath(hasProfile),
    );
  }

  if (
    user &&
    shouldRedirectToMoneyProfile({
      signedIn: true,
      hasProfile: false,
      pathname,
    })
  ) {
    const hasProfile = await userHasMoneyProfile(supabase, user.id);
    if (
      shouldRedirectToMoneyProfile({
        signedIn: true,
        hasProfile,
        pathname,
      })
    ) {
      return redirectWithSession(
        request,
        supabaseResponse,
        MONEY_PROFILE_PATH,
      );
    }
  }

  return supabaseResponse;
}

export { isProtectedRoute };
