import { NextResponse } from "next/server";
import { markPlaidWebhook } from "@/lib/plaid/store";

/**
 * Stub webhook. Amar should set this URL in the Plaid dashboard:
 *   https://<production-domain>/api/plaid/webhook
 * Product users sync from Budget. This route acknowledges Plaid and
 * stamps the item so a later Sync can pick up new transactions.
 */
export async function POST(request: Request) {
  let body: { item_id?: string; webhook_type?: string; webhook_code?: string } =
    {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const itemId = body.item_id?.trim();
  if (itemId) {
    try {
      await markPlaidWebhook(itemId);
    } catch {
      // Storage may be unset in preview — still 200 so Plaid does not retry forever.
    }
  }
  return NextResponse.json({
    received: true,
    webhookType: body.webhook_type ?? null,
    webhookCode: body.webhook_code ?? null,
  });
}
