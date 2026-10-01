import { isFeatureFlagId, type FeatureFlagId } from "@/lib/flags/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

type OverrideRow = { flag: string; enabled: boolean };

/**
 * Saved on/off values for one account. Missing flag means no override.
 * A missing service key or a missing table yields an empty map (no grant).
 */
export async function readFlagOverrides(
  userId: string,
): Promise<Map<FeatureFlagId, boolean>> {
  const result = new Map<FeatureFlagId, boolean>();
  const admin = createAdminClient();
  if (!admin) return result;

  const { data, error } = await admin
    .from("feature_flag_overrides")
    .select("flag, enabled")
    .eq("user_id", userId);
  if (error || !data) return result;

  for (const row of data as OverrideRow[]) {
    if (isFeatureFlagId(row.flag) && typeof row.enabled === "boolean") {
      result.set(row.flag, row.enabled);
    }
  }
  return result;
}

export async function readFlagOverride(
  userId: string,
  flag: FeatureFlagId,
): Promise<boolean | null> {
  const overrides = await readFlagOverrides(userId);
  return overrides.has(flag) ? (overrides.get(flag) ?? null) : null;
}
