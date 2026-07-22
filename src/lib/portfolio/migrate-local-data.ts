import {
  loadOptionsFromCloud,
  loadPortfolioFromCloud,
  loadPreferencesFromCloud,
  saveOptionsToCloud,
  savePortfolioToCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import {
  loadWithBackup,
  optionsStorageKeys,
  portfolioStorageKeys,
  readJsonFromStorage,
} from "@/lib/portfolio/local-storage";
import type { DisplayCurrency } from "@/types/currency";
import { isDisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import type { PortfolioHolding } from "@/types/portfolio";

const CURRENCY_KEY = "my-invest-master-currency";

function loadLocalPortfolio(): PortfolioHolding[] {
  return loadWithBackup<PortfolioHolding>(
    portfolioStorageKeys.key,
    portfolioStorageKeys.backupKey,
  );
}

function loadLocalOptions(): OptionsPosition[] {
  return loadWithBackup<OptionsPosition>(
    optionsStorageKeys.key,
    optionsStorageKeys.backupKey,
  );
}

function loadLocalCurrency(): DisplayCurrency | null {
  const stored = readJsonFromStorage<string>(CURRENCY_KEY);
  if (stored && isDisplayCurrency(stored)) return stored;
  try {
    const raw = localStorage.getItem(CURRENCY_KEY);
    if (raw && isDisplayCurrency(raw)) return raw;
  } catch {
    // ignore
  }
  return null;
}

export async function migrateLocalDataToCloud(userId: string): Promise<void> {
  const [remotePortfolio, remoteOptions, remoteCurrency] = await Promise.all([
    loadPortfolioFromCloud(userId),
    loadOptionsFromCloud(userId),
    loadPreferencesFromCloud(userId),
  ]);

  const localPortfolio = loadLocalPortfolio();
  const localOptions = loadLocalOptions();
  const localCurrency = loadLocalCurrency();

  const uploads: Promise<void>[] = [];

  if (
    (remotePortfolio === null || remotePortfolio.length === 0) &&
    localPortfolio.length > 0
  ) {
    uploads.push(savePortfolioToCloud(userId, localPortfolio));
  }

  if (
    (remoteOptions === null || remoteOptions.length === 0) &&
    localOptions.length > 0
  ) {
    uploads.push(saveOptionsToCloud(userId, localOptions));
  }

  if (remoteCurrency === null && localCurrency !== null) {
    uploads.push(savePreferencesToCloud(userId, localCurrency));
  }

  await Promise.all(uploads);
}
