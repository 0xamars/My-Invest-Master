import { NextResponse } from "next/server";
import { isPlaidEncryptionReady } from "@/lib/plaid/crypto";
import {
  isPlaidConfigured,
  isPlaidStorageReady,
  parsePlaidEnv,
  webhookUrlFromEnv,
} from "@/lib/plaid/config";
import { isFeatureEnabled } from "@/lib/flags/server";
import { listPlaidItemsForPlan } from "@/lib/plaid/store";
import type { PlaidItemSummary } from "@/lib/plaid/types";
import { jsonError, requirePlaidUser } from "@/lib/plaid/http";

export async function GET(request: Request) {
  const auth = await requirePlaidUser(request, { requireBankFlag: false });
  if ("error" in auth && auth.error) return auth.error;

  const enabled = auth.user
    ? await isFeatureEnabled("bank_connect", auth.user.id)
    : false;

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId")?.trim() ?? "";
  const configured = isPlaidConfigured() && isPlaidEncryptionReady();
  const storageReady = isPlaidStorageReady();

  let items: PlaidItemSummary[] = [];
  if (configured && storageReady && planId && auth.user) {
    try {
      items = await listPlaidItemsForPlan(auth.user.id, planId);
    } catch {
      items = [];
    }
  }

  return NextResponse.json({
    enabled,
    configured,
    storageReady,
    env: parsePlaidEnv(process.env.PLAID_ENV),
    webhookUrl: webhookUrlFromEnv(),
    items,
  });
}

export function POST() {
  return jsonError("Use GET", 405);
}
