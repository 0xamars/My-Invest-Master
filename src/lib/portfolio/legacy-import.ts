import {
  loadOptionsFromCloud,
  loadPortfolioFromCloud,
  loadPreferencesFromCloud,
  saveOptionsToCloud,
  savePortfolioToCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import type { DisplayCurrency } from "@/types/currency";
import { isDisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import type { PortfolioHolding } from "@/types/portfolio";

const LEGACY_KEYS = [
  "my-invest-master-portfolio",
  "my-invest-master-portfolio-backup",
  "my-invest-master-options",
  "my-invest-master-options-backup",
  "my-invest-master-currency",
] as const;

function readLegacyJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readLegacyArray<T>(primaryKey: string, backupKey: string): T[] {
  const primary = readLegacyJson<T[]>(primaryKey);
  if (primary && Array.isArray(primary)) return primary;

  const backup = readLegacyJson<T[]>(backupKey);
  if (backup && Array.isArray(backup)) return backup;

  return [];
}

function clearLegacyStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

/** One-time upload of pre-cloud browser data, then remove legacy keys. */
export async function importLegacyLocalDataOnce(userId: string): Promise<void> {
  const legacyPortfolio = readLegacyArray<PortfolioHolding>(
    "my-invest-master-portfolio",
    "my-invest-master-portfolio-backup",
  );
  const legacyOptions = readLegacyArray<OptionsPosition>(
    "my-invest-master-options",
    "my-invest-master-options-backup",
  );
  const legacyCurrencyRaw = readLegacyJson<string>("my-invest-master-currency");
  const legacyCurrency =
    legacyCurrencyRaw && isDisplayCurrency(legacyCurrencyRaw)
      ? legacyCurrencyRaw
      : null;

  const hasLegacyData =
    legacyPortfolio.length > 0 ||
    legacyOptions.length > 0 ||
    legacyCurrency !== null;

  if (!hasLegacyData) return;

  const [remotePortfolio, remoteOptions, remoteCurrency] = await Promise.all([
    loadPortfolioFromCloud(userId),
    loadOptionsFromCloud(userId),
    loadPreferencesFromCloud(userId),
  ]);

  const uploads: Promise<void>[] = [];

  if (
    legacyPortfolio.length > 0 &&
    (remotePortfolio === null || remotePortfolio.length === 0)
  ) {
    uploads.push(savePortfolioToCloud(userId, legacyPortfolio));
  }

  if (
    legacyOptions.length > 0 &&
    (remoteOptions === null || remoteOptions.length === 0)
  ) {
    uploads.push(saveOptionsToCloud(userId, legacyOptions));
  }

  if (legacyCurrency !== null && remoteCurrency === null) {
    uploads.push(savePreferencesToCloud(userId, legacyCurrency as DisplayCurrency));
  }

  if (uploads.length === 0) {
    clearLegacyStorage();
    return;
  }

  await Promise.all(uploads);
  clearLegacyStorage();
}
