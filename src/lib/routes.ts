/** Public marketing homepage (logo always returns here). */
export const MARKETING_HOME_PATH = "/";

/** Logged-in account overview dashboard. */
export const APP_HOME_PATH = "/home";

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const SIGNIN_PATH = "/signin";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_RESET_PATH = "/auth/reset";
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";
export const PRICING_PATH = "/pricing";

/** Relative paths the auth callback / login `next` query may land on. */
export function safeAuthNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return APP_HOME_PATH;
  }
  if (raw.includes("\\") || raw.includes("://")) {
    return APP_HOME_PATH;
  }
  return raw;
}
