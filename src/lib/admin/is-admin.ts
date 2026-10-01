import { createAdminClient } from "@/lib/supabase/admin";

/**
 * True only when this user id is in app_admins.
 * The table is not readable from the browser. A missing service key is not admin.
 */
export async function isAdmin(
  user: { id: string } | null | undefined,
): Promise<boolean> {
  if (!user?.id) return false;
  const admin = createAdminClient();
  if (!admin) return false;

  const { data, error } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}
