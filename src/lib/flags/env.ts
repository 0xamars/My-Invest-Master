/**
 * Shared parser for environment feature flags.
 * Unset, `0`, and `false` are off. `1` and `true` are on.
 * Same rule as the market-data gate.
 */
export function parseEnvFlag(raw: string | undefined | null): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true";
}
