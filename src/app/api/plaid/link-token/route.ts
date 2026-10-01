import { NextResponse } from "next/server";
import { createPlaidLinkToken, PlaidRequestError } from "@/lib/plaid/client";
import { readPlaidConfig } from "@/lib/plaid/config";
import { jsonError, plaidSetupError, requirePlaidUser } from "@/lib/plaid/http";
import { loadPlaidItemForUser } from "@/lib/plaid/store";

export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const setup = plaidSetupError();
  if (setup) return setup;

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
