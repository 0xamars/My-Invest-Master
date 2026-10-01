import { NextResponse } from "next/server";
import { removePlaidItem } from "@/lib/plaid/client";
import { deletePlaidItemRow } from "@/lib/plaid/store";
import { jsonError, plaidSetupError, requirePlaidUser } from "@/lib/plaid/http";

export async function DELETE(request: Request) {
  const auth = await requirePlaidUser(request, { requireBankFlag: false });
  if ("error" in auth && auth.error) return auth.error;
  const setup = plaidSetupError();
  if (setup) return setup;

  let body: { itemId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }
  const itemId = body.itemId?.trim() ?? "";
  if (!itemId) return jsonError("itemId is required", 400);

  try {
    const row = await deletePlaidItemRow({
      userId: auth.user!.id,
      itemId,
    });
    if (row) {
      await removePlaidItem(row.access_token);
    }
    return NextResponse.json({ ok: true, itemId });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not disconnect bank",
      502,
    );
  }
}
