import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminConsole } from "@/components/admin/admin-console";
import { isAdmin } from "@/lib/admin/is-admin";
import { canSeedOwnAccount } from "@/lib/admin/test-account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user))) notFound();

  return (
    <AdminConsole
      signedInEmail={user.email ?? ""}
      signedInCanSeed={canSeedOwnAccount(user.email)}
    />
  );
}
