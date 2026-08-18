/** Subset of cookie serialize options used by @supabase/ssr setAll. */
export type SessionCookieOptions = {
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  domain?: string;
  expires?: Date;
};

/**
 * Keep @supabase/ssr cookie names/values. Fill in SameSite + Secure when the
 * library omitted them. Do not force HttpOnly — the browser client reads
 * the session cookie. Secure is only set on HTTPS so local http still works.
 */
export function mergeSessionCookieOptions(
  incoming: SessionCookieOptions | undefined,
  isHttps: boolean,
): SessionCookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    ...incoming,
    secure: incoming?.secure ?? isHttps,
  };
}
