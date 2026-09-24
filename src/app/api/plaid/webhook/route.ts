import { NextResponse } from "next/server";
import {
  parsePlaidWebhookBody,
  resolvePlaidWebhookItemStatus,
} from "@/lib/plaid/item-status";
import { markPlaidItemStatus, markPlaidWebhook } from "@/lib/plaid/store";
import { verifyPlaidWebhookRequest } from "@/lib/plaid/webhook-verify";

/**
 * Plaid dashboard URL:
 *   https://<production-domain>/api/plaid/webhook
 * ITEM_LOGIN_REQUIRED / ITEM ERROR marks the item so Budget can Reconnect.
 * Transaction webhooks only stamp updated_at; users still tap Sync.
 * The Plaid-Verification JWT is checked before any item row is touched.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = await verifyPlaidWebhookRequest({
    rawBody,
    verificationJwt: request.headers.get("plaid-verification"),
  });
  if (!verified.ok) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let body: unknown = {};
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return NextResponse.json({ received: true });
    }
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
