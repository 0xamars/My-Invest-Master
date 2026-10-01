import { NextResponse } from "next/server";
import { jsonError, plaidSetupError, requirePlaidUser } from "@/lib/plaid/http";
import { savePlaidAccountBudgetIds } from "@/lib/plaid/store";

/**
 * Records which budget account each bank account feeds.
 * Transactions themselves stay in the budget plan.
 */
export async function POST(request: Request) {
  const auth = await requirePlaidUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const setup = plaidSetupError();
  if (setup) return setup;

  let body: {
    itemId?: string;
    mappings?: Array<{ plaidAccountId?: string; budgetAccountId?: string }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid body", 400);
  }
  const itemId = body.itemId?.trim() ?? "";
  const mappings = (body.mappings ?? [])
    .map((row) => ({
      plaidAccountId: row.plaidAccountId?.trim() ?? "",
      budgetAccountId: row.budgetAccountId?.trim() ?? "",
    }))
    .filter((row) => row.plaidAccountId && row.budgetAccountId);
  if (!itemId || mappings.length === 0) {
    return jsonError("itemId and mappings are required", 400);
  }

  try {
    await savePlaidAccountBudgetIds({
      userId: auth.user!.id,
      itemId,
      mappings,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not save the account link",
      502,
    );
  }
}
