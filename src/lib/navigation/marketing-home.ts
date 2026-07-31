"use client";

import { useCallback } from "react";
import { MARKETING_HOME_PATH } from "@/lib/routes";

/**
 * Navigate to the public marketing homepage (`/`).
 * Uses a full navigation so logo / "Back to home" work after sign-out
 * and on temporary post-auth screens (client soft-nav can stall there).
 */
export function goToMarketingHome() {
  if (typeof window === "undefined") return;
  window.location.assign(MARKETING_HOME_PATH);
}

export function useGoToMarketingHome() {
  return useCallback(() => {
    goToMarketingHome();
  }, []);
}
