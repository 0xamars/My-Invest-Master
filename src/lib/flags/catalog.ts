import { parseEnvFlag } from "@/lib/flags/env";

/**
 * Product flags. Environment variables are the default for every account.
 * A row in feature_flag_overrides replaces that default for one account.
 * Adding a flag here also requires the check constraint in
 * supabase/migrations/019_admin_and_flags.sql.
 */
export const FEATURE_FLAG_IDS = [
  "bank_connect",
  "fmp_display",
  "retire_no_login_planner",
] as const;

export type FeatureFlagId = (typeof FEATURE_FLAG_IDS)[number];

export type FeatureFlagKind = "default" | "fmp_display";

export type FeatureFlagDefinition = {
  id: FeatureFlagId;
  label: string;
  description: string;
  env: string;
  kind: FeatureFlagKind;
};

export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    id: "bank_connect",
    label: "Bank connection",
    description:
      "Shows bank linking in Budget for this account. Off for everyone unless this is on, or the server setting is on. BANK_CONNECT_ENABLED=0 turns it off for every account.",
    env: "NEXT_PUBLIC_BANK_CONNECT_ENABLED",
    kind: "default",
  },
  {
    id: "fmp_display",
    label: "Market data",
    description:
      "Use this while the market data gate is on. On lets this confirmed account see prices and company figures. Off removes that access even if the account is on the server email list. While the gate is off, market data stays available to every account.",
    env: "FMP_DISPLAY_GATE_ENABLED",
    kind: "fmp_display",
  },
  {
    id: "retire_no_login_planner",
    label: "Retire planner without sign-in",
    description:
      "Reserved for a public Retire planner. That page is not published. Turning this on does not add a public page.",
    env: "NEXT_PUBLIC_RETIRE_NO_LOGIN_PLANNER_ENABLED",
    kind: "default",
  },
];

export function isFeatureFlagId(value: string): value is FeatureFlagId {
  return (FEATURE_FLAG_IDS as readonly string[]).includes(value);
}

export function featureFlagDefinition(
  flag: FeatureFlagId,
): FeatureFlagDefinition {
  const found = FEATURE_FLAGS.find((item) => item.id === flag);
  if (!found) throw new Error(`Unknown flag ${flag}`);
  return found;
}

/** Environment default. For market data this is the gate, not "show data to everyone". */
export function envEnablesFlag(
  flag: FeatureFlagId,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return parseEnvFlag(env[featureFlagDefinition(flag).env]);
}

/**
 * Default flags: a saved override wins. No row uses the environment value.
 * Market data access is decided in the display gate, not here.
 * This returns whether the override grants the account extra access.
 */
export function resolveFeatureFlag(
  flag: FeatureFlagId,
  envEnabled: boolean,
  override: boolean | null,
): boolean {
  if (featureFlagDefinition(flag).kind === "fmp_display") {
    return override === true;
  }
  if (override !== null) return override;
  return envEnabled;
}
