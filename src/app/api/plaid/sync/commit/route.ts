import { NextResponse } from "next/server";
import { isPlaidConfigured, isPlaidStorageReady } from "@/lib/plaid/config";
import { jsonError, requirePlaidUser } from "@/lib/plaid/http";
import { commitPlaidItemCursor, loadPlaidItemForUser } from "@/lib/plaid/store";

/**
 * Stores the transactions cursor after the browser has written the budget plan.
 * The compare is the cursor this sync read, so a later sync cannot be rewound.
 */
export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  if (!isPlaidConfigured()) {
    return jsonError("Bank linking is not configured on this server.", 503);
  }
  if (!isPlaidStorageReady()) {
    return jsonError("Bank linking needs a server database key.", 503);
  }

  let body: { itemId?: string; previousCursor?: string | null; nextCursor?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }
  const itemId = body.itemId?.trim() ?? "";
  const nextCursor = body.nextCursor?.trim() ?? "";
  if (!itemId || !nextCursor) {
    return jsonError("itemId and nextCursor are required", 400);
  }
  const previousCursor =
    typeof body.previousCursor === "string" && body.previousCursor.trim()
      ? body.previousCursor.trim()
      : null;

  try {
    const row = await loadPlaidItemForUser({
      userId: auth.user!.id,
      itemId,
    });
    if (!row) return jsonError("Bank connection not found", 404);
    const committed = await commitPlaidItemCursor({
      id: row.id,
      userId: auth.user!.id,
      previousCursor,
      nextCursor,
      syncedAt: new Date().toISOString(),
    });
    return NextResponse.json({ advanced: committed.advanced });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not store the bank bookmark",
      502,
    );
  }
}
