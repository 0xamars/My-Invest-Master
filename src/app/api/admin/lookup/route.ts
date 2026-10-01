import { NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin/access";
import { describeFlagsForAdmin } from "@/lib/admin/flag-state";
import {
  loadUserHealth,
  lookupAccountByEmail,
  overridesForUser,
  writeAdminAudit,
} from "@/lib/admin/service";
import { normalizeLookupEmail } from "@/lib/admin/test-account";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  let body: { email?: unknown } = {};
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    body = {};
  }
  const email =
    typeof body.email === "string" ? normalizeLookupEmail(body.email) : null;
  if (!email) {
    return NextResponse.json(
      { error: "Enter a full email address." },
      { status: 400, headers: noStore },
    );
  }

  try {
    const account = await lookupAccountByEmail(email);
    await writeAdminAudit({
      adminId: auth.user.id,
      action: "lookup_user",
      targetUserId: account?.id ?? null,
    });
    if (!account) {
      return NextResponse.json(
        { error: "No account uses that email." },
        { status: 404, headers: noStore },
      );
    }
    const health = await loadUserHealth(account);
    const flags = describeFlagsForAdmin(await overridesForUser(account.id));
    return NextResponse.json({ health, flags }, { headers: noStore });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
