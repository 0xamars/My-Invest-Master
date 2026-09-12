import { NextResponse } from "next/server";
import { createPlaidLinkToken, PlaidRequestError } from "@/lib/plaid/client";
import { isPlaidConfigured, isPlaidStorageReady, readPlaidConfig } from "@/lib/plaid/config";
import { loadPlaidItemForUser } from "@/lib/plaid/store";
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

  let body: { itemId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const itemId = body.itemId?.trim() ?? "";

  try {
    let accessToken: string | undefined;
    if (itemId) {
      const row = await loadPlaidItemForUser({
        userId: auth.user!.id,
        itemId,
      });
      if (!row) return jsonError("Bank connection not found", 404);
      accessToken = row.access_token;
    }

    const linkToken = await createPlaidLinkToken({
      userId: auth.user!.id,
      config: readPlaidConfig(),
      accessToken,
    });
    return NextResponse.json({
      linkToken,
      updateMode: Boolean(accessToken),
    });
  } catch (error) {
    if (error instanceof PlaidRequestError) {
      return jsonError(error.message, error.status || 502);
    }
    return jsonError(
      error instanceof Error ? error.message : "Could not start bank link",
      502,
    );
  }
}
