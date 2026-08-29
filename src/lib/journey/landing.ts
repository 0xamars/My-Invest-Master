import {
  APP_HOME_PATH,
  MONEY_PROFILE_PATH,
} from "@/lib/routes";
import { isProtectedRoute, isPublicRoute } from "@/lib/security/protected-routes";

function isMoneyProfilePath(pathname: string): boolean {
  return (
    pathname === MONEY_PROFILE_PATH ||
    pathname.startsWith(`${MONEY_PROFILE_PATH}/`)
  );
}

/**
 * Soft Invest Do locks stay client-side (skip + warning).
 * Middleware never hard-blocks `/invest?tab=do` for a book or budgetElsewhere.
 */
export const MIDDLEWARE_HARD_BLOCKS_INVEST_DO = false;

/** Signed-in landing. Not a fourth nav pillar. */
export function signedInLandingPath(hasProfile: boolean): string {
  return hasProfile ? APP_HOME_PATH : MONEY_PROFILE_PATH;
}

/** Signed-in visitors do not stay on the public marketing homepage. */
export function shouldRedirectSignedInFromMarketing(input: {
  signedIn: boolean;
  pathname: string;
}): boolean {
  return input.signedIn && input.pathname === "/";
}

export function isMissingMoneyProfileTable(error: {
  message: string;
  code?: string;
}): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("user_money_profiles")
  );
}

/**
 * Presence only. A missing table, empty row, or lookup error is "no profile".
 * Never invents a Money Profile to pass the gate.
 */
export function moneyProfilePresenceFromQuery(input: {
  data: { user_id?: string } | null;
  error: { message: string; code?: string } | null;
}): boolean {
  if (input.error) return false;
  const userId = input.data?.user_id;
  return typeof userId === "string" && userId.length > 0;
}

export function shouldRedirectToMoneyProfile(input: {
  signedIn: boolean;
  hasProfile: boolean;
  pathname: string;
}): boolean {
  if (!input.signedIn) return false;
  if (input.hasProfile) return false;
  if (isMoneyProfilePath(input.pathname)) return false;
  if (isPublicRoute(input.pathname)) return false;
  return isProtectedRoute(input.pathname);
}

/** Login / signup bounce for an already-signed-in visitor. */
export function signedInAuthRedirectPath(hasProfile: boolean): string {
  return signedInLandingPath(hasProfile);
}

/**
 * Documented no-op: Slice C locks stay in the client.
 * Do not call this from middleware with live budget/book flags.
 */
export function middlewareShouldHardBlockInvestDo(_input?: {
  pathname?: string;
  search?: string;
  hasBook?: boolean;
  budgetElsewhere?: boolean;
  budgetWorking?: boolean;
}): boolean {
  return MIDDLEWARE_HARD_BLOCKS_INVEST_DO;
}
