import { createClient } from "@/lib/supabase/client";
import type { DisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import type { PortfolioHolding } from "@/types/portfolio";

function getClient() {
  return createClient();
}

export async function waitForSupabaseSession(
  timeoutMs = 5000,
): Promise<void> {
  const supabase = getClient();
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Unable to establish auth session for cloud sync.");
}

export async function loadPortfolioFromCloud(
  userId: string,
): Promise<PortfolioHolding[] | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_portfolios")
    .select("holdings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseJsonArray<PortfolioHolding>(data.holdings);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function savePortfolioToCloud(
  userId: string,
  holdings: PortfolioHolding[],
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_portfolios").upsert(
    {
      user_id: userId,
      holdings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function loadOptionsFromCloud(
  userId: string,
): Promise<OptionsPosition[] | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_options")
    .select("positions")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return parseJsonArray<OptionsPosition>(data.positions);
}

export async function saveOptionsToCloud(
  userId: string,
  positions: OptionsPosition[],
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_options").upsert(
    {
      user_id: userId,
      positions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function loadPreferencesFromCloud(
  userId: string,
): Promise<DisplayCurrency | null> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("display_currency")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data.display_currency;
}

export async function savePreferencesToCloud(
  userId: string,
  displayCurrency: DisplayCurrency,
): Promise<void> {
  await waitForSupabaseSession();
  const supabase = getClient();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      display_currency: displayCurrency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
