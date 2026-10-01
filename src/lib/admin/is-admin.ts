import {
  isEmailVerified,
  isListedAdminEmail,
  normalizeAdminEmail,
} from "@/lib/admin/admin-email";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
} | null | undefined;

type GrantResult = "admin" | "not-listed" | "error";

/**
 * Confirmed user ids already resolved against the allowlist in this process.
 * Skips repeat queries on ordinary requests. isAdmin() does not use this,
 * so /admin still sees an email added in SQL.
 */
const listedGrantChecked = new Set<string>();

/**
 * True when this user id is in app_admins, or this confirmed email is in
 * app_admin_emails. A matching email is written into app_admins.
 * The allowlist is SQL-only. A missing service key is not admin.
 */
export async function isAdmin(user: AdminUser): Promise<boolean> {
  return (await ensureListedAdmin(user)) === "admin";
}

/** First confirmed request after sign-in. Safe to call on later requests. */
export async function grantListedAdminOnSignIn(user: AdminUser): Promise<void> {
  if (!user?.id || !isEmailVerified(user.email_confirmed_at)) return;
  if (listedGrantChecked.has(user.id)) return;
  try {
    const result = await ensureListedAdmin(user);
    if (result !== "error") listedGrantChecked.add(user.id);
  } catch {
    listedGrantChecked.delete(user.id);
  }
}

async function ensureListedAdmin(user: AdminUser): Promise<GrantResult> {
  if (!user?.id) return "not-listed";
  const admin = createAdminClient();
  if (!admin) return "error";

  const { data: byId, error: idError } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (idError) return "error";
  if (byId) return "admin";

  const email = normalizeAdminEmail(user.email);
  if (!email || !isEmailVerified(user.email_confirmed_at)) return "not-listed";

  const { data: listed, error: listError } = await admin
    .from("app_admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (listError) return "error";
  if (!listed || !isListedAdminEmail(user, new Set([email]))) return "not-listed";

  const { error: insertError } = await admin
    .from("app_admins")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (insertError) return "error";
  return "admin";
}
