import {
  planAccountDeletion,
  revokePlaidItemsBeforeDrop,
  userOwnedDeleteOrder,
} from "@/lib/account/delete-account";
import { isPlaidConfigured } from "@/lib/plaid/config";
import { removePlaidItemForDeletion } from "@/lib/plaid/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Revokes Plaid items, deletes every user-owned table, then deletes the auth user.
 * Service role stays on the server. Tokens are not dropped when Plaid cannot be called.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return Response.json(
      { error: "Auth is not configured.", authUserDeleted: false, dataDeleted: false },
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
      { error: "Sign in to delete your account.", authUserDeleted: false, dataDeleted: false },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({
      ok: true,
      authUserDeleted: false,
      dataDeleted: false,
      plaidItemsRevoked: 0,
      message:
        "Signed-in data other than bank connections can be deleted in this browser. Disconnecting banks and removing the auth user needs SUPABASE_SERVICE_ROLE_KEY on the server.",
    });
  }

  const { data: items, error: itemsError } = await admin
    .from("user_plaid_items")
    .select("item_id, access_token")
    .eq("user_id", user.id);

  if (itemsError) {
    return Response.json(
      {
        error: itemsError.message,
        authUserDeleted: false,
        dataDeleted: false,
      },
      { status: 500 },
    );
  }

  const plan = planAccountDeletion({
    plaidItems: (items ?? []).map((row) => ({
      itemId: String(row.item_id ?? ""),
      accessToken: String(row.access_token ?? ""),
    })),
    plaidConfigured: isPlaidConfigured(),
  });

  if (!plan.dropRows) {
    return Response.json(
      {
        ok: false,
        authUserDeleted: false,
        dataDeleted: false,
        plaidItemsRevoked: 0,
        error:
          "Linked banks are still connected. Plaid is not configured on the server, so the account was not deleted and bank tokens were kept.",
      },
      { status: 409 },
    );
  }

  try {
    await revokePlaidItemsBeforeDrop({
      accessTokens: plan.revokeAccessTokens,
      removeItem: (accessToken) => removePlaidItemForDeletion(accessToken),
      dropRows: async () => {
        for (const table of userOwnedDeleteOrder()) {
          const { error: deleteError } = await admin
            .from(table)
            .delete()
            .eq("user_id", user.id);
          if (deleteError) throw new Error(deleteError.message);
        }
      },
    });
  } catch (caught) {
    return Response.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "Unable to disconnect banks and delete account data.",
        authUserDeleted: false,
        dataDeleted: false,
      },
      { status: 500 },
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({
      ok: true,
      authUserDeleted: false,
      dataDeleted: true,
      plaidItemsRevoked: plan.revokeAccessTokens.length,
      message: deleteError.message,
    });
  }

  return Response.json({
    ok: true,
    authUserDeleted: true,
    dataDeleted: true,
    plaidItemsRevoked: plan.revokeAccessTokens.length,
  });
}
