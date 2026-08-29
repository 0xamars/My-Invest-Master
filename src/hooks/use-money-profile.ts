"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { finalizeMoneyProfile } from "@/lib/journey/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  loadMoneyProfileFromCloud,
  saveMoneyProfileToCloud,
} from "@/lib/supabase/user-data";
import type { MoneyProfile } from "@/types/money-profile";

type MoneyProfileContextValue = {
  profile: MoneyProfile | null;
  isLoaded: boolean;
  loadSucceeded: boolean;
  saveProfile: (next: MoneyProfile) => Promise<void>;
  isSaving: boolean;
};

const MoneyProfileContext = createContext<MoneyProfileContextValue | null>(null);

export function MoneyProfileProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [profile, setProfile] = useState<MoneyProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadVersionRef = useRef(0);

  useEffect(() => {
    if (isAuthLoading) return;

    const version = ++loadVersionRef.current;
    let cancelled = false;

    async function load() {
      setIsLoaded(false);
      setLoadSucceeded(false);

      if (!user || !isSupabaseConfigured()) {
        if (!cancelled && version === loadVersionRef.current) {
          setProfile(null);
          setLoadSucceeded(true);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const remote = await loadMoneyProfileFromCloud(user.id);
        if (!cancelled && version === loadVersionRef.current) {
          setProfile(remote);
          setLoadSucceeded(true);
        }
      } catch {
        if (!cancelled && version === loadVersionRef.current) {
          setProfile(null);
          setLoadSucceeded(false);
        }
      } finally {
        if (!cancelled && version === loadVersionRef.current) {
          setIsLoaded(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  const saveProfile = useCallback(
    async (next: MoneyProfile) => {
      if (!user || !isSupabaseConfigured()) {
        throw new Error("Sign in to save your Money Profile.");
      }
      const finalized = finalizeMoneyProfile(next);
      setIsSaving(true);
      try {
        await saveMoneyProfileToCloud(user.id, finalized);
        setProfile(finalized);
      } finally {
        setIsSaving(false);
      }
    },
    [user],
  );

  const value = useMemo<MoneyProfileContextValue>(
    () => ({
      profile,
      isLoaded,
      loadSucceeded,
      saveProfile,
      isSaving,
    }),
    [profile, isLoaded, loadSucceeded, saveProfile, isSaving],
  );

  return createElement(MoneyProfileContext.Provider, { value }, children);
}

export function useMoneyProfile(): MoneyProfileContextValue {
  const context = useContext(MoneyProfileContext);
  if (!context) {
    throw new Error("useMoneyProfile must be used within MoneyProfileProvider");
  }
  return context;
}
