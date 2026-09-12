/**
 * Plaid item health — reconnect vs still-usable.
 * Status lives on user_plaid_items.status (migration 013). No new columns.
 */

export const PLAID_ITEM_STATUSES = [
  "active",
  "needs_reconnect",
  "error",
  "disconnected",
] as const;

export type PlaidItemStatus = (typeof PLAID_ITEM_STATUSES)[number];

const RECONNECT_ERROR_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "ITEM_LOCKED",
  "USER_PERMISSION_REVOKED",
  "ACCESS_NOT_GRANTED",
]);

const ITEM_RECONNECT_WEBHOOK_CODES = new Set([
  "ERROR",
  "PENDING_EXPIRATION",
  "USER_PERMISSION_REVOKED",
  "PENDING_DISCONNECT",
]);

export function normalizePlaidItemStatus(value: string | null | undefined): PlaidItemStatus {
  const status = value?.trim().toLowerCase();
  if (status === "needs_reconnect") return "needs_reconnect";
  if (status === "error") return "error";
  if (status === "disconnected") return "disconnected";
  return "active";
}

export function isListedPlaidItemStatus(status: string | null | undefined): boolean {
  return normalizePlaidItemStatus(status) !== "disconnected";
}

export function plaidItemNeedsUserReconnect(status: string | null | undefined): boolean {
  const normalized = normalizePlaidItemStatus(status);
  return normalized === "needs_reconnect" || normalized === "error";
}

export function plaidErrorNeedsReconnect(errorCode: string | null | undefined): boolean {
  return RECONNECT_ERROR_CODES.has((errorCode ?? "").trim().toUpperCase());
}

export type PlaidWebhookFields = {
  itemId: string | null;
  webhookType: string;
  webhookCode: string;
  errorCode: string | null;
};

export function parsePlaidWebhookBody(body: unknown): PlaidWebhookFields {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const itemId =
    typeof record.item_id === "string" && record.item_id.trim()
      ? record.item_id.trim()
      : null;
  const webhookType =
    typeof record.webhook_type === "string" ? record.webhook_type.trim() : "";
  const webhookCode =
    typeof record.webhook_code === "string" ? record.webhook_code.trim() : "";
  const error =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const errorCode =
    error && typeof error.error_code === "string" ? error.error_code.trim() : null;
  return { itemId, webhookType, webhookCode, errorCode };
}

/**
 * Null means "stamp updated_at only" — transactions/default webhooks.
 * LOGIN_REPAIRED clears a previous reconnect flag.
 */
export function resolvePlaidWebhookItemStatus(
  fields: PlaidWebhookFields,
): PlaidItemStatus | null {
  if (plaidErrorNeedsReconnect(fields.errorCode)) return "needs_reconnect";

  const type = fields.webhookType.toUpperCase();
  const code = fields.webhookCode.toUpperCase();

  if (type === "ITEM") {
    if (code === "LOGIN_REPAIRED") return "active";
    if (ITEM_RECONNECT_WEBHOOK_CODES.has(code)) return "needs_reconnect";
  }

  return null;
}

export function formatPlaidItemSyncLine(item: {
  status: string;
  lastSyncedAt: string | null;
}): string {
  if (plaidItemNeedsUserReconnect(item.status)) {
    return "Sign-in expired · reconnect to keep pulling transactions";
  }
  if (item.lastSyncedAt) {
    const at = Date.parse(item.lastSyncedAt);
    if (Number.isFinite(at)) {
      return `Last sync ${new Date(at).toLocaleString()}`;
    }
  }
  return "Connected · sync to pull transactions";
}
