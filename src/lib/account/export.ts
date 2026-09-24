import {
  ACCOUNT_SECRET_KEYS,
  USER_OWNED_TABLES,
  type UserOwnedTable,
} from "@/lib/account/tables";

export {
  ACCOUNT_SECRET_KEYS,
  CLIENT_DELETABLE_USER_TABLES,
  PLAID_ITEM_EXPORT_COLUMNS,
  USER_OWNED_TABLES,
} from "@/lib/account/tables";

export type AccountExportTable = UserOwnedTable;

export type AccountExportRows = Record<UserOwnedTable, unknown[]>;

export type AccountExportPayload = {
  exportedAt: string;
  userId: string;
} & AccountExportRows;

export function stripAccountSecrets<T>(value: T): T {
  return stripValue(value) as T;
}

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripValue);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((ACCOUNT_SECRET_KEYS as readonly string[]).includes(key)) continue;
    output[key] = stripValue(child);
  }
  return output;
}

export function containsAccountSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAccountSecret);
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((ACCOUNT_SECRET_KEYS as readonly string[]).includes(key)) return true;
    if (containsAccountSecret(child)) return true;
  }
  return false;
}

export function buildAccountExportPayload(
  input: {
    exportedAt: string;
    userId: string;
  } & AccountExportRows,
): AccountExportPayload {
  const payload = {
    exportedAt: input.exportedAt,
    userId: input.userId,
  } as AccountExportPayload;
  for (const table of USER_OWNED_TABLES) {
    payload[table] = stripAccountSecrets(input[table] ?? []);
  }
  return payload;
}

export function isAccountExportPayload(
  value: unknown,
): value is AccountExportPayload {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  if (typeof raw.exportedAt !== "string" || typeof raw.userId !== "string") {
    return false;
  }
  for (const table of USER_OWNED_TABLES) {
    if (!Array.isArray(raw[table])) return false;
  }
  return !containsAccountSecret(value);
}
