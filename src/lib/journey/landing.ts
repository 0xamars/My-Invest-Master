import { APP_HOME_PATH, MONEY_PROFILE_PATH } from "@/lib/routes";

function isMoneyProfilePath(pathname: string): boolean {
  return (
    pathname === MONEY_PROFILE_PATH ||
    pathname.startsWith(`${MONEY_PROFILE_PATH}/`)
  );
}

/**
 * Soft locks are off. Middleware never hard-blocks Invest.
 */
export const MIDDLEWARE_HARD_BLOCKS_INVEST_DO = false;

/** Signed-in landing is the Home hub — not Budget, not a quiz. */
export function signedInLandingPath(_hasProfile?: boolean): string {
  return APP_HOME_PATH;
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
 * Never invents a Money Profile.
 */
export function moneyProfilePresenceFromQuery(input: {
  data: { user_id?: string } | null;
  error: { message: string; code?: string } | null;
}): boolean {
  if (input.error) return false;
  const userId = input.data?.user_id;
  return typeof userId === "string" && userId.length > 0;
}

/** Money Profile quiz is unshipped — never redirect into it. */
export function shouldRedirectToMoneyProfile(_input: {
  signedIn: boolean;
  hasProfile: boolean;
  pathname: string;
}): boolean {
  return false;
}

/** Unshipped Money Profile only. `/home` is the signed-in hub. */
export function isBypassedJourneyPath(pathname: string): boolean {
  return isMoneyProfilePath(pathname);
}

/** Login / signup bounce for an already-signed-in visitor. */
export function signedInAuthRedirectPath(_hasProfile?: boolean): string {
  return signedInLandingPath();
}

/**
 * Documented no-op: Invest is never middleware-gated.
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
