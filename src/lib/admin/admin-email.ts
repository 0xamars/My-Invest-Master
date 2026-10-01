/**
 * Dedicated test/admin login. Not a personal inbox.
 * The migration seeds this address. More addresses are added only in SQL.
 */
export const INITIAL_ADMIN_EMAIL = "admin@investsalsa.com";

/** Full address, lowercased. Not a prefix and not a plus-tag of another inbox. */
export function normalizeAdminEmail(
  email: string | null | undefined,
): string | null {
  const value = email?.trim().toLowerCase();
  if (!value || value.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function isEmailVerified(
  emailConfirmedAt: string | null | undefined,
): boolean {
  return typeof emailConfirmedAt === "string" && emailConfirmedAt.trim().length > 0;
}

/**
 * True when this confirmed address is on the SQL allowlist.
 * An unconfirmed address never matches, even if the text is the same.
 */
export function isListedAdminEmail(
  user: {
    email?: string | null;
    email_confirmed_at?: string | null;
  },
  listedEmails: ReadonlySet<string>,
): boolean {
  if (!isEmailVerified(user.email_confirmed_at)) return false;
  const email = normalizeAdminEmail(user.email);
  if (!email) return false;
  return listedEmails.has(email);
}
