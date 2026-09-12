import { NextResponse } from "next/server";
import {
  parsePlaidWebhookBody,
  resolvePlaidWebhookItemStatus,
} from "@/lib/plaid/item-status";
import { markPlaidItemStatus, markPlaidWebhook } from "@/lib/plaid/store";

/**
 * Plaid dashboard URL:
 *   https://<production-domain>/api/plaid/webhook
 * ITEM_LOGIN_REQUIRED / ITEM ERROR marks the item so Budget can Reconnect.
 * Transaction webhooks only stamp updated_at; users still tap Sync.
 */
export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = parsePlaidWebhookBody(body);
  if (parsed.itemId) {
    try {
      const nextStatus = resolvePlaidWebhookItemStatus(parsed);
      if (nextStatus) {
        await markPlaidItemStatus({
          itemId: parsed.itemId,
          status: nextStatus,
        });
      } else {
        await markPlaidWebhook(parsed.itemId);
      }
    } catch {
      // Storage may be unset in preview — still 200 so Plaid does not retry forever.
    }
  }
  return NextResponse.json({
    received: true,
    webhookType: parsed.webhookType || null,
    webhookCode: parsed.webhookCode || null,
    status: resolvePlaidWebhookItemStatus(parsed),
  });
}
