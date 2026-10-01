/**
 * Bank connection stays off unless a flag is exactly `1` or `true`.
 * Unset, `0`, and `false` leave Budget unchanged.
 *
 * `NEXT_PUBLIC_BANK_CONNECT_ENABLED` is read by the browser and the server
 * (it is inlined at build time, so changing it needs a redeploy).
 * `BANK_CONNECT_ENABLED` is the server-side switch. When it is set, it wins:
 * `0` or `false` turns the API off even if the public flag is on.
 */
export function isBankConnectEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const server = env.BANK_CONNECT_ENABLED?.trim().toLowerCase();
  if (server === "0" || server === "false") return false;
  if (server === "1" || server === "true") return true;
  const pub = env.NEXT_PUBLIC_BANK_CONNECT_ENABLED?.trim().toLowerCase();
  return pub === "1" || pub === "true";
}

/**
 * Per-account bank connection.
 * `BANK_CONNECT_ENABLED=0` turns it off for every account.
 * Otherwise an override wins, and no override uses the server switch above.
 */
export function resolveBankConnectForAccount(
  override: boolean | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const server = env.BANK_CONNECT_ENABLED?.trim().toLowerCase();
  if (server === "0" || server === "false") return false;
  if (override !== null) return override;
  return isBankConnectEnabled(env);
}
