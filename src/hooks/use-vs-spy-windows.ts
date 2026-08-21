"use client";

import { useEffect, useMemo, useState } from "react";
import type { VsSpyWindow } from "@/lib/invest/vs-spy";

export type VsSpyRequest = {
  id: string;
  from: string;
  to: string;
  holdingReturnPercent: number | null;
};

export function useVsSpyWindows(windows: VsSpyRequest[]) {
  const [results, setResults] = useState<Record<string, VsSpyWindow>>({});
  const [isLoading, setIsLoading] = useState(false);

  const signature = useMemo(
    () =>
      windows
        .map((item) => `${item.id}:${item.from}:${item.to}:${item.holdingReturnPercent ?? ""}`)
        .join("|"),
    [windows],
  );

  useEffect(() => {
    if (windows.length === 0) {
      setResults({});
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void fetch("/api/invest/vs-spy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windows }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("vs SPY failed");
        return (await response.json()) as {
          results?: Array<VsSpyWindow & { id: string }>;
        };
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const next: Record<string, VsSpyWindow> = {};
        for (const row of payload.results ?? []) {
          next[row.id] = row;
        }
        setResults(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setResults({});
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // windows is represented by signature to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { results, isLoading };
}
