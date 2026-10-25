/**
 * A Supabase token refresh hands the hook a new user object with the same id.
 * That is the same session. Reloading the budget on it would drop the edit
 * on screen and could save that older edit at the newer server version.
 */
export function budgetPlanReloadAction(input: {
  /** Undefined until this mounted hook has started a load. */
  loadedUserId: string | null | undefined;
  nextUserId: string | null;
}): "reload" | "keep" {
  if (input.loadedUserId === undefined) return "reload";
  if (input.loadedUserId === input.nextUserId) return "keep";
  return "reload";
}

/**
 * What to do with a server snapshot when this tab still has an edit
 * that has not been saved.
 * - keep-conflict: the server version moved. Do not adopt it, and do not
 *   write the local edit at that newer version.
 * - keep-pending: the server version matches. Keep the edit on screen so
 *   the save can still persist it.
 * - replace: nothing is waiting. Take the server snapshot.
 */
export function remoteBudgetLoadAction(input: {
  pendingPlanIds: readonly string[];
  baseVersions: ReadonlyMap<string, number>;
  serverVersions: Readonly<Record<string, number | undefined>>;
}): "keep-conflict" | "keep-pending" | "replace" {
  for (const id of input.pendingPlanIds) {
    if (!input.baseVersions.has(id)) continue;
    const base = input.baseVersions.get(id);
    const server = input.serverVersions[id];
    if (typeof base === "number" && typeof server === "number" && server !== base) {
      return "keep-conflict";
    }
  }
  if (input.pendingPlanIds.length > 0) return "keep-pending";
  return "replace";
}

/** Persist a waiting edit when the tab is hidden or the page is going away. */
export function shouldFlushBudgetPlanOnLeave(input: {
  reason: "visibilitychange" | "pagehide";
  visibilityState: "visible" | "hidden" | "prerender";
}): boolean {
  if (input.reason === "pagehide") return true;
  return input.visibilityState === "hidden";
}
