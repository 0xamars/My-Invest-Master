import { NextResponse } from "next/server";
import {
  isPlaidConfigured,
  isPlaidStorageReady,
  parsePlaidEnv,
  webhookUrlFromEnv,
} from "@/lib/plaid/config";
import { listPlaidItemsForPlan } from "@/lib/plaid/store";
import type { PlaidItemSummary } from "@/lib/plaid/types";
import { jsonError, requirePlaidUser } from "@/lib/plaid/http";

export async function GET(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId")?.trim() ?? "";
  const configured = isPlaidConfigured();
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
