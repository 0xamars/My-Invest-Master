/** Safe avatar initial. Never throws on missing user, email, or metadata. */
export function accountInitial(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): string {
  const meta = user?.user_metadata;
  const fromMeta =
    meta && typeof meta === "object"
      ? firstNonEmptyString(
          meta.full_name,
          meta.name,
          meta.display_name,
          meta.displayName,
        )
      : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const source = fromMeta || email;
  const ch = source.charAt(0);
  if (!ch) return "A";
  try {
    return ch.toUpperCase();
  } catch {
    return "A";
  }
}

export function accountLabel(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): string | null {
  const meta = user?.user_metadata;
  const fromMeta =
    meta && typeof meta === "object"
      ? firstNonEmptyString(
          meta.full_name,
          meta.name,
          meta.display_name,
          meta.displayName,
        )
      : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  return fromMeta || email || null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}
