/** Neutral copy when FMP market data is withheld. */
export const FMP_DISPLAY_UNAVAILABLE =
  "Market data is not available on your account yet";

/**
 * Gate is off unless the flag is exactly `1` or `true`.
 * Unset, `0`, and `false` keep today's behavior.
 */
export function isFmpDisplayGateEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.FMP_DISPLAY_GATE_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

export function parseFmpDisplayAllowlist(
  raw: string | undefined | null,
): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Gate off: everyone, including signed-out visitors.
 * Gate on: only an allowlisted email whose address is confirmed.
 * Missing email, or an unconfirmed signup, is denied.
 */
export function fmpDisplayAllowsEmail(
  email: string | null | undefined,
  options: {
    enabled: boolean;
    allowlist: ReadonlySet<string>;
    emailConfirmed?: boolean;
  },
): boolean {
  if (!options.enabled) return true;
  if (options.emailConfirmed !== true) return false;
  if (!email) return false;
  return options.allowlist.has(email.trim().toLowerCase());
}

export function apiFailureMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    (body as { error?: unknown }).error === FMP_DISPLAY_UNAVAILABLE
  ) {
    return FMP_DISPLAY_UNAVAILABLE;
  }
  return fallback;
}

export async function readFailureMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    return apiFailureMessage(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

/** Keep the existing fallback unless the failure is the display gate. */
export function uiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message === FMP_DISPLAY_UNAVAILABLE) {
    return err.message;
  }
  return fallback;
}
