import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin/access";
import { resetTestAccountData, seedTestAccountDemo, writeAdminAudit } from "@/lib/admin/service";
import { canSeedOwnAccount } from "@/lib/admin/test-account";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  let body: { action?: unknown; confirm?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const action = body.action === "seed" || body.action === "reset" ? body.action : null;
  if (!action) {
    return NextResponse.json(
      { error: "Choose an action." },
      { status: 400, headers: noStore },
    );
  }
  if (!canSeedOwnAccount(auth.user.email)) {
    return NextResponse.json(
      { error: "Demo data is only for this signed-in test login." },
      { status: 400, headers: noStore },
    );
  }
  if (action === "reset" && body.confirm !== "reset") {
    return NextResponse.json(
      { error: "Reset needs confirmation." },
      { status: 400, headers: noStore },
    );
  }

  try {
    await writeAdminAudit({
      adminId: auth.user.id,
      action: action === "seed" ? "seed_demo" : "reset_demo",
      targetUserId: auth.user.id,
    });
    if (action === "seed") await seedTestAccountDemo(auth.user.id);
    else await resetTestAccountData(auth.user.id);
    return NextResponse.json(
      {
        ok: true,
        message:
          action === "seed"
            ? "Sample budget, portfolio, and Retire plan were added."
            : "This account's plans were removed. The sign-in is unchanged.",
      },
      { headers: noStore },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
