import {
  envEnablesFlag,
  resolveFeatureFlag,
  type FeatureFlagId,
} from "@/lib/flags/catalog";
import { readFlagOverride, readFlagOverrides } from "@/lib/flags/overrides";
import { isFmpDisplayAllowed } from "@/lib/market-data/display-gate-server";

export type DefaultFeatureFlagId = Exclude<FeatureFlagId, "fmp_display">;

/**
 * Environment default, then a per-user override when a row exists.
 * Market data uses the display gate instead of this helper.
 */
export async function isFeatureEnabled(
  flag: DefaultFeatureFlagId,
  userId: string | null | undefined,
): Promise<boolean> {
  const envOn = envEnablesFlag(flag);
  if (!userId) return envOn;
  const override = await readFlagOverride(userId, flag);
  return resolveFeatureFlag(flag, envOn, override);
}

/** Booleans for the signed-in account. Market data is the real access check. */
export async function resolvePublicFlags(userId: string | null): Promise<
  Record<FeatureFlagId, boolean>
> {
  const overrides = userId ? await readFlagOverrides(userId) : new Map();
  const bankEnv = envEnablesFlag("bank_connect");
  const retireEnv = envEnablesFlag("retire_no_login_planner");
  const bankOverride = overrides.has("bank_connect")
    ? (overrides.get("bank_connect") ?? null)
    : null;
  const retireOverride = overrides.has("retire_no_login_planner")
    ? (overrides.get("retire_no_login_planner") ?? null)
    : null;

  return {
    bank_connect: resolveFeatureFlag("bank_connect", bankEnv, bankOverride),
    retire_no_login_planner: resolveFeatureFlag(
      "retire_no_login_planner",
      retireEnv,
      retireOverride,
    ),
    fmp_display: await isFmpDisplayAllowed(),
  };
}
