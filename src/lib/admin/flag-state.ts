import {
  FEATURE_FLAGS,
  envEnablesFlag,
  resolveFeatureFlag,
  type FeatureFlagId,
  type FeatureFlagKind,
} from "@/lib/flags/catalog";

export type AdminFlagState = {
  id: FeatureFlagId;
  label: string;
  description: string;
  kind: FeatureFlagKind;
  /** Environment value. For market data this is the gate, not "shown to everyone". */
  serverOn: boolean;
  /** Null when this account has no saved override. */
  override: boolean | null;
  /**
   * Resolved on/off for default flags.
   * Null for market data, because access also depends on the gate and a confirmed email.
   */
  effective: boolean | null;
};

export function describeFlagsForAdmin(
  overrides: ReadonlyMap<FeatureFlagId, boolean>,
  env: Record<string, string | undefined> = process.env,
): AdminFlagState[] {
  return FEATURE_FLAGS.map((flag) => {
    const serverOn = envEnablesFlag(flag.id, env);
    const override = overrides.has(flag.id)
      ? (overrides.get(flag.id) ?? null)
      : null;
    return {
      id: flag.id,
      label: flag.label,
      description: flag.description,
      kind: flag.kind,
      serverOn,
      override,
      effective:
        flag.kind === "fmp_display"
          ? null
          : resolveFeatureFlag(flag.id, serverOn, override),
    };
  });
}

export function flagAuditAction(
  flag: FeatureFlagId,
  enabled: boolean | null,
): string {
  const state = enabled === null ? "default" : enabled ? "on" : "off";
  return `set_flag:${flag}:${state}`;
}
