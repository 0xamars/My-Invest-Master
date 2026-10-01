"use client";

import { useEffect, useState } from "react";
import { parseEnvFlag } from "@/lib/flags/env";
import type { FeatureFlagId } from "@/lib/flags/catalog";

function clientEnvDefault(flag: FeatureFlagId): boolean {
  if (flag === "bank_connect") {
    return parseEnvFlag(process.env.NEXT_PUBLIC_BANK_CONNECT_ENABLED);
  }
  if (flag === "retire_no_login_planner") {
    return parseEnvFlag(process.env.NEXT_PUBLIC_RETIRE_NO_LOGIN_PLANNER_ENABLED);
  }
  return false;
}

/**
 * Resolved flag for the signed-in account.
 * Null until the server answers. A failed request falls back to the public
 * environment default, which is off unless that variable is 1 or true.
 */
export function useFeatureFlag(flag: FeatureFlagId): boolean | null {
  const [value, setValue] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/flags", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("flags");
        return (await response.json()) as {
          flags?: Partial<Record<FeatureFlagId, boolean>>;
        };
      })
      .then((body) => {
        if (cancelled) return;
        const next = body.flags?.[flag];
        setValue(typeof next === "boolean" ? next : clientEnvDefault(flag));
      })
      .catch(() => {
        if (!cancelled) setValue(clientEnvDefault(flag));
      });
    return () => {
      cancelled = true;
    };
  }, [flag]);

  return value;
}
