import { parseEnvFlag } from "@/lib/flags/env";

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
  return parseEnvFlag(env.FMP_DISPLAY_GATE_ENABLED);
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
 * Gate off: everyone, including signed-out visitors. Overrides are ignored
 * so today's behavior stays. Turn the gate on before a per-user override
 * can grant or remove market data.
 * Gate on: a confirmed account with an override of on, or a confirmed
 * allowlisted email. An override of off denies even an allowlisted email.
 * Missing email, or an unconfirmed signup, is denied.
 */
export function fmpDisplayAllowsEmail(
  email: string | null | undefined,
  options: {
    enabled: boolean;
    allowlist: ReadonlySet<string>;
    emailConfirmed?: boolean;
    userOverride?: boolean | null;
  },
): boolean {
  if (!options.enabled) return true;
  if (options.userOverride === false) return false;
  if (options.userOverride === true && options.emailConfirmed === true) {
    return true;
  }
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
