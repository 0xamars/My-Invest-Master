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

const LEGACY_PORTFOLIO_KEY = "my-invest-master-portfolio";
const LEGACY_PORTFOLIO_BACKUP_KEY = "my-invest-master-portfolio-backup";
const LEGACY_OPTIONS_KEY = "my-invest-master-options";
const LEGACY_OPTIONS_BACKUP_KEY = "my-invest-master-options-backup";
const LEGACY_CURRENCY_KEY = "my-invest-master-currency";

let importPromise: Promise<void> | null = null;
let importUserId: string | null = null;

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

function clearLegacyPortfolioKeys() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_PORTFOLIO_KEY);
  localStorage.removeItem(LEGACY_PORTFOLIO_BACKUP_KEY);
}

function clearLegacyOptionsKeys() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_OPTIONS_KEY);
  localStorage.removeItem(LEGACY_OPTIONS_BACKUP_KEY);
}

function clearLegacyCurrencyKey() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_CURRENCY_KEY);
}

export function readLegacyPortfolio(): PortfolioHolding[] {
  return readLegacyArray<PortfolioHolding>(
    LEGACY_PORTFOLIO_KEY,
    LEGACY_PORTFOLIO_BACKUP_KEY,
  );
}

export function hasLegacyPortfolioData(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    localStorage.getItem(LEGACY_PORTFOLIO_KEY) ||
      localStorage.getItem(LEGACY_PORTFOLIO_BACKUP_KEY),
  );
}

async function runLegacyImport(userId: string): Promise<void> {
  const legacyPortfolio = readLegacyPortfolio();
  const legacyOptions = readLegacyArray<OptionsPosition>(
    LEGACY_OPTIONS_KEY,
    LEGACY_OPTIONS_BACKUP_KEY,
  );
  const legacyCurrencyRaw = readLegacyJson<string>(LEGACY_CURRENCY_KEY);
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

  const remotePortfolioCount = remotePortfolio?.length ?? 0;
  const remoteOptionsCount = remoteOptions?.length ?? 0;

  const uploads: Promise<void>[] = [];
  let willUploadPortfolio = false;
  let willUploadOptions = false;
  let willUploadCurrency = false;

  if (legacyPortfolio.length > 0 && remotePortfolioCount === 0) {
    willUploadPortfolio = true;
    uploads.push(savePortfolioToCloud(userId, legacyPortfolio));
  }

  if (legacyOptions.length > 0 && remoteOptionsCount === 0) {
    willUploadOptions = true;
    uploads.push(saveOptionsToCloud(userId, legacyOptions));
  }

  if (legacyCurrency !== null && remoteCurrency === null) {
    willUploadCurrency = true;
    uploads.push(
      savePreferencesToCloud(userId, legacyCurrency as DisplayCurrency),
    );
  }

  if (uploads.length === 0) return;

  await Promise.all(uploads);

  if (willUploadPortfolio) clearLegacyPortfolioKeys();
  if (willUploadOptions) clearLegacyOptionsKeys();
  if (willUploadCurrency) clearLegacyCurrencyKey();
}

/** One-time upload of pre-cloud browser data, then remove migrated legacy keys. */
export async function importLegacyLocalDataOnce(userId: string): Promise<void> {
  if (importPromise && importUserId === userId) {
    return importPromise;
  }

  importUserId = userId;
  importPromise = runLegacyImport(userId).finally(() => {
    importPromise = null;
    importUserId = null;
  });

  return importPromise;
}

/** Force-import legacy portfolio into cloud when cloud is empty. */
export async function importLegacyPortfolioIfNeeded(
  userId: string,
): Promise<PortfolioHolding[] | null> {
  await importLegacyLocalDataOnce(userId);

  const legacyPortfolio = readLegacyPortfolio();
  const remote = await loadPortfolioFromCloud(userId);
  const remoteCount = remote?.length ?? 0;

  if (remoteCount > 0) return remote;
  if (legacyPortfolio.length === 0) return remote;

  await savePortfolioToCloud(userId, legacyPortfolio);
  clearLegacyPortfolioKeys();
  return legacyPortfolio;
}
