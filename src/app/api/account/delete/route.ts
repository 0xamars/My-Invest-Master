import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

/**
 * Deletes the signed-in auth user after plan rows are wiped client-side.
 * Service role stays on the server — never sent to the browser.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return Response.json(
      { error: "Auth is not configured.", authUserDeleted: false },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json(
      { error: "Sign in to delete your account.", authUserDeleted: false },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({
      ok: true,
      authUserDeleted: false,
      message:
        "Plan rows can be deleted with your session. Auth user deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.",
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json(
      {
        error: deleteError.message,
        authUserDeleted: false,
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, authUserDeleted: true });
}
