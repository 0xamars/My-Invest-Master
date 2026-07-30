import {
  loadOptionsFromCloud,
  loadOrMigratePortfolioPlans,
  loadPortfolioFromCloud,
  loadPortfolioPlansFromCloud,
  loadPreferencesFromCloud,
  saveOptionsToCloud,
  savePortfolioPlanToCloud,
  savePreferencesToCloud,
} from "@/lib/supabase/user-data";
import type { DisplayCurrency } from "@/types/currency";
import { isDisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import {
  createEmptyPortfolio,
  type PortfolioHolding,
} from "@/types/portfolio";

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

/** Clear stale single-portfolio browser backups after cloud is authoritative. */
export function clearStaleLegacyPortfolioKeys() {
  clearLegacyPortfolioKeys();
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

  let existingPlanHoldingCount = 0;
  try {
    const remotePlans = await loadPortfolioPlansFromCloud(userId);
    existingPlanHoldingCount = remotePlans.reduce(
      (sum, plan) => sum + plan.holdings.length,
      0,
    );
  } catch {
    existingPlanHoldingCount = 0;
  }

  if (existingPlanHoldingCount === 0) {
    const remoteLegacy = await loadPortfolioFromCloud(userId);
    existingPlanHoldingCount = remoteLegacy?.length ?? 0;
  }

  const [remoteOptions, remoteCurrency] = await Promise.all([
    loadOptionsFromCloud(userId),
    loadPreferencesFromCloud(userId),
  ]);

  const remoteOptionsCount = remoteOptions?.length ?? 0;

  const uploads: Promise<void>[] = [];
  let willUploadPortfolio = false;
  let willUploadOptions = false;
  let willUploadCurrency = false;

  if (legacyPortfolio.length > 0 && existingPlanHoldingCount === 0) {
    willUploadPortfolio = true;
    const portfolio = createEmptyPortfolio("My Portfolio", { isPrimary: true });
    portfolio.holdings = legacyPortfolio;
    uploads.push(savePortfolioPlanToCloud(userId, portfolio));
  } else if (legacyPortfolio.length > 0) {
    // Cloud already has portfolio data — discard stale browser backup so the
    // restore banner does not stick around incorrectly.
    clearLegacyPortfolioKeys();
  }

  if (legacyOptions.length > 0 && remoteOptionsCount === 0) {
    willUploadOptions = true;
    uploads.push(saveOptionsToCloud(userId, legacyOptions));
  } else if (legacyOptions.length > 0) {
    clearLegacyOptionsKeys();
  }

  if (legacyCurrency !== null && remoteCurrency === null) {
    willUploadCurrency = true;
    uploads.push(
      savePreferencesToCloud(userId, {
        displayCurrency: legacyCurrency as DisplayCurrency,
        plan: "free",
      }),
    );
  } else if (legacyCurrency !== null) {
    clearLegacyCurrencyKey();
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

/**
 * Ensure legacy browser / single-portfolio cloud data is migrated, then return
 * primary (or first) portfolio holdings.
 */
export async function importLegacyPortfolioIfNeeded(
  userId: string,
): Promise<PortfolioHolding[] | null> {
  await importLegacyLocalDataOnce(userId);

  const plans = await loadOrMigratePortfolioPlans(userId);
  const primary = plans.find((plan) => plan.isPrimary) ?? plans[0];
  return primary?.holdings ?? [];
}
