import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin/access";
import { resetTestAccountData, seedTestAccountDemo, writeAdminAudit } from "@/lib/admin/service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  let body: { userId?: unknown; action?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const action = body.action === "seed" || body.action === "reset" ? body.action : null;
  if (!userId || !action) {
    return NextResponse.json(
      { error: "Choose a test account and an action." },
      { status: 400, headers: noStore },
    );
  }

  try {
    if (action === "seed") await seedTestAccountDemo(userId);
    else await resetTestAccountData(userId);
    await writeAdminAudit({
      adminId: auth.user.id,
      action: action === "seed" ? "seed_demo" : "reset_demo",
      targetUserId: userId,
    });
    return NextResponse.json(
      {
        ok: true,
        message:
          action === "seed"
            ? "Sample budget, portfolio, and Retire plan were added."
            : "That account's plans were removed. The sign-in is unchanged.",
      },
      { headers: noStore },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
