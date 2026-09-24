/**
 * Debounced plan saves and an immediate save can race.
 * Flush must not report success when the plan was never queued,
 * already taken by the debounce, or the in-flight write failed.
 */
export async function flushQueuedPlanSave<T>(input: {
  planId: string;
  pending: Map<string, T>;
  inflight: Promise<void> | undefined;
  save: (plan: T) => Promise<void>;
}): Promise<void> {
  const plan = input.pending.get(input.planId);
  if (plan) {
    input.pending.delete(input.planId);
    await input.save(plan);
    return;
  }
  if (input.inflight) {
    await input.inflight;
  }
}

/** A debounced snapshot is stale once a newer save for that plan has been enqueued. */
export function debouncedPlanSaveIsStale(
  epochAtDequeue: number,
  epochNow: number,
): boolean {
  return epochNow !== epochAtDequeue;
}
