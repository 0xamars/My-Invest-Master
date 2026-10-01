import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin/access";
import { describeFlagsForAdmin, flagAuditAction } from "@/lib/admin/flag-state";
import {
  overridesForUser,
  setFlagOverride,
  writeAdminAudit,
} from "@/lib/admin/service";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  let body: { userId?: unknown; flag?: unknown; enabled?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const flag = typeof body.flag === "string" ? body.flag : "";
  const enabled =
    body.enabled === null || typeof body.enabled === "boolean"
      ? body.enabled
      : undefined;
  if (!userId || !flag || enabled === undefined) {
    return NextResponse.json(
      { error: "Choose an account and a flag." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const saved = await setFlagOverride({ userId, flag, enabled });
    await writeAdminAudit({
      adminId: auth.user.id,
      action: flagAuditAction(saved, enabled),
      targetUserId: userId,
    });
    const flags = describeFlagsForAdmin(await overridesForUser(userId));
    return NextResponse.json({ flags }, { headers: noStore });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
