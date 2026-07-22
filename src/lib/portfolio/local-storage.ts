const PORTFOLIO_KEY = "my-invest-master-portfolio";
const PORTFOLIO_BACKUP_KEY = "my-invest-master-portfolio-backup";
const OPTIONS_KEY = "my-invest-master-options";
const OPTIONS_BACKUP_KEY = "my-invest-master-options-backup";

export function readJsonFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJsonToStorage<T>(key: string, backupKey: string, value: T) {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem(key);
  if (current) {
    localStorage.setItem(backupKey, current);
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadWithBackup<T>(key: string, backupKey: string): T[] {
  const primary = readJsonFromStorage<T[]>(key);
  if (primary && Array.isArray(primary)) {
    return primary;
  }

  const backup = readJsonFromStorage<T[]>(backupKey);
  if (backup && Array.isArray(backup)) {
    return backup;
  }

  return [];
}

export function hasStoredData(key: string, backupKey: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    localStorage.getItem(key) || localStorage.getItem(backupKey),
  );
}

export const portfolioStorageKeys = {
  key: PORTFOLIO_KEY,
  backupKey: PORTFOLIO_BACKUP_KEY,
} as const;

export const optionsStorageKeys = {
  key: OPTIONS_KEY,
  backupKey: OPTIONS_BACKUP_KEY,
} as const;
