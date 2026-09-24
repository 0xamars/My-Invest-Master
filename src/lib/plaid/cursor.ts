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

/**
 * `save` must reject when the budget plan was not written.
 * `commit` runs only after that write (or when there was nothing to write).
 */
export async function commitPlaidCursorAfterSave(input: {
  save: () => Promise<void>;
  commit: () => Promise<void>;
}): Promise<void> {
  await input.save();
  await input.commit();
}
