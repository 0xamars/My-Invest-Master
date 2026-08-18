/** Compatible with cookie `SerializeOptions` from @supabase/ssr setAll. */
export type SessionCookieOptions = {
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  domain?: string;
  expires?: Date;
};

function resolveSameSite(
  value: SessionCookieOptions["sameSite"],
): "lax" | "strict" | "none" {
  if (value === true || value === "strict") return "strict";
  if (value === "none") return "none";
  return "lax";
}

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
    ...incoming,
    sameSite: resolveSameSite(incoming?.sameSite),
    secure: incoming?.secure ?? isHttps,
  };
}
