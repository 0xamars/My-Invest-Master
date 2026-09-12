import { NextResponse } from "next/server";
import {
  exchangePlaidPublicToken,
  fetchPlaidAccounts,
  PlaidRequestError,
  syncPlaidTransactions,
} from "@/lib/plaid/client";
import { isPlaidConfigured, isPlaidStorageReady } from "@/lib/plaid/config";
import {
  markPlaidItemSynced,
  upsertPlaidItem,
} from "@/lib/plaid/store";
import { jsonError, requirePlaidUser } from "@/lib/plaid/http";

export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  if (!isPlaidConfigured()) {
    return jsonError("Bank linking is not configured on this server.", 503);
  }
  if (!isPlaidStorageReady()) {
    return jsonError("Bank linking needs a server database key.", 503);
  }

  let body: {
    publicToken?: string;
    planId?: string;
    institution?: { institution_id?: string; name?: string };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }

  const publicToken = body.publicToken?.trim() ?? "";
  const planId = body.planId?.trim() ?? "";
  if (!publicToken || !planId) {
    return jsonError("publicToken and planId are required", 400);
  }

  try {
    const exchanged = await exchangePlaidPublicToken(publicToken);
    const accounts = await fetchPlaidAccounts(exchanged.accessToken);
    const item = await upsertPlaidItem({
      userId: auth.user!.id,
      planId,
      itemId: exchanged.itemId,
      accessToken: exchanged.accessToken,
      institutionId: body.institution?.institution_id ?? null,
      institutionName: body.institution?.name ?? null,
      accounts,
    });
    const syncedAt = new Date().toISOString();
    let transactions = [] as Awaited<
      ReturnType<typeof syncPlaidTransactions>
    >["transactions"];
    try {
      const sync = await syncPlaidTransactions({
        accessToken: exchanged.accessToken,
        cursor: null,
      });
      transactions = sync.transactions;
      await markPlaidItemSynced({
        id: item.id,
        cursor: sync.nextCursor,
        lastSyncedAt: syncedAt,
      });
    } catch {
      // Sandbox can be empty until HISTORICAL_UPDATE. Accounts still link.
    }

    return NextResponse.json({
      item,
      payload: {
        itemId: exchanged.itemId,
        institutionName: item.institutionName,
        syncedAt,
        accounts,
        transactions,
      },
    });
  } catch (error) {
    if (error instanceof PlaidRequestError) {
      return jsonError(error.message, error.status || 502);
    }
    return jsonError(
      error instanceof Error ? error.message : "Could not connect bank",
      502,
    );
  }
}
