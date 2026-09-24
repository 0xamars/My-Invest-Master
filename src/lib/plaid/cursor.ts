/**
 * The Plaid cursor is a bookmark into `/transactions/sync`.
 * Move it only after the budget plan that contains this batch is durable.
 * Compare-and-swap on the cursor the sync started from so a slower tab
 * cannot rewind a bookmark a faster tab already advanced.
 */
export function advancePlaidCursor(input: {
  storedCursor: string | null;
  baseCursor: string | null;
  nextCursor: string;
}): { cursor: string | null; advanced: boolean } {
  const stored = input.storedCursor ?? null;
  const base = input.baseCursor ?? null;
  const next = input.nextCursor.trim();
  if (!next || stored !== base) {
    return { cursor: stored, advanced: false };
  }
  if (stored === next) {
    return { cursor: stored, advanced: false };
  }
  return { cursor: next, advanced: true };
}

/** A batch that changed accounts or transactions must be saved before the cursor moves. */
export function plaidSyncNeedsDurableSave(payload: {
  accounts?: readonly unknown[];
  transactions?: readonly unknown[];
  modified?: readonly unknown[];
  removedTransactionIds?: readonly unknown[];
}): boolean {
  return (
    (payload.accounts?.length ?? 0) > 0 ||
    (payload.transactions?.length ?? 0) > 0 ||
    (payload.modified?.length ?? 0) > 0 ||
    (payload.removedTransactionIds?.length ?? 0) > 0
  );
}

export const PLAID_CURSOR_NOT_SAVED =
  "Bank transactions were not saved, so the sync bookmark was left unchanged.";

/**
 * `save` must reject when the budget plan was not written.
 * When the batch changed data, `plan` is that exact plan. A missing plan
 * (the React updater has not queued it, or a debounce already took it)
 * is a failed save: the cursor stays where it was.
 * `commit` runs only after that write, or when there was nothing to write.
 */
export async function commitPlaidCursorAfterSave<T>(input: {
  needsSave: boolean;
  plan: T | null;
  save: (plan: T) => Promise<void>;
  commit: () => Promise<void>;
}): Promise<void> {
  if (input.needsSave) {
    if (input.plan == null) {
      throw new Error(PLAID_CURSOR_NOT_SAVED);
    }
    await input.save(input.plan);
  }
  await input.commit();
}
