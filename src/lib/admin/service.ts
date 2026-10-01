import {
  buildSampleDataset,
  SAMPLE_BUDGET_NAME,
  SAMPLE_PORTFOLIO_NAME,
  SAMPLE_RETIRE_NAME,
  TEST_ACCOUNT_RESET_TABLES,
} from "@/lib/admin/demo-data";
import { buildUserHealth, type UserHealth } from "@/lib/admin/health";
import { isTestAccountEmail, isUserId } from "@/lib/admin/test-account";
import { isFeatureFlagId, type FeatureFlagId } from "@/lib/flags/catalog";
import { readFlagOverrides } from "@/lib/flags/overrides";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AdminServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminServiceError";
    this.status = status;
  }
}

type QueryError = { code?: string; message?: string } | null;

function adminClient(): SupabaseClient {
  const admin = createAdminClient();
  if (!admin) {
    throw new AdminServiceError(
      "The server database key is not set, so admin tools are unavailable.",
      503,
    );
  }
  return admin;
}

function missingMigration(error: QueryError): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42883" ||
    message.includes("admin_user_health") ||
    message.includes("admin_lookup_user_by_email") ||
    message.includes("app_admins") ||
    message.includes("feature_flag_overrides") ||
    message.includes("admin_audit_log") ||
    message.includes("schema cache")
  );
}

function raise(error: QueryError, fallback: string): never {
  if (missingMigration(error)) {
    throw new AdminServiceError(
      "Apply the admin database migration, then try again.",
      503,
    );
  }
  throw new AdminServiceError(fallback, 500);
}

export type AccountIdentity = {
  id: string;
  email: string;
  createdAt: string | null;
};

export async function lookupAccountByEmail(
  email: string,
): Promise<AccountIdentity | null> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("admin_lookup_user_by_email", {
    target_email: email,
  });
  if (error) raise(error, "Could not look up that email.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const record = row as { id?: unknown; email?: unknown; created_at?: unknown };
  if (typeof record.id !== "string" || typeof record.email !== "string") {
    return null;
  }
  return {
    id: record.id,
    email: record.email,
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
  };
}

async function accountById(userId: string): Promise<AccountIdentity | null> {
  if (!isUserId(userId)) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    createdAt: data.user.created_at ?? null,
  };
}

export async function loadUserHealth(
  account: AccountIdentity,
): Promise<UserHealth> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("admin_user_health", {
    target: account.id,
  });
  if (error) raise(error, "Could not load account health.");
  const row = Array.isArray(data) ? data[0] : data;
  const record =
    row && typeof row === "object"
      ? (row as {
          budget_plans?: unknown;
          budget_accounts?: unknown;
          budget_transactions?: unknown;
          portfolios?: unknown;
          retire_plans?: unknown;
          plan?: unknown;
          last_activity?: unknown;
        })
      : {};
  return buildUserHealth({
    userId: account.id,
    email: account.email,
    createdAt: account.createdAt,
    testAccount: isTestAccountEmail(account.email),
    row: record,
  });
}

export async function writeAdminAudit(input: {
  adminId: string;
  action: string;
  targetUserId: string | null;
}): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    admin_id: input.adminId,
    action: input.action,
    target_user_id: input.targetUserId,
  });
  if (error) raise(error, "Could not record this admin action.");
}

export async function overridesForUser(userId: string) {
  return readFlagOverrides(userId);
}

export async function setFlagOverride(input: {
  userId: string;
  flag: string;
  enabled: boolean | null;
}): Promise<FeatureFlagId> {
  if (!isUserId(input.userId)) {
    throw new AdminServiceError("That account id is not valid.", 400);
  }
  if (!isFeatureFlagId(input.flag)) {
    throw new AdminServiceError("That flag is not available.", 400);
  }
  const account = await accountById(input.userId);
  if (!account) {
    throw new AdminServiceError("No account uses that id.", 404);
  }

  const admin = adminClient();
  if (input.enabled === null) {
    const { error } = await admin
      .from("feature_flag_overrides")
      .delete()
      .eq("user_id", input.userId)
      .eq("flag", input.flag);
    if (error) raise(error, "Could not clear that flag.");
  } else {
    const { error } = await admin.from("feature_flag_overrides").upsert(
      {
        user_id: input.userId,
        flag: input.flag,
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,flag" },
    );
    if (error) raise(error, "Could not save that flag.");
  }
  return input.flag;
}

async function requireTestAccount(userId: string): Promise<AccountIdentity> {
  if (!isUserId(userId)) {
    throw new AdminServiceError("That account id is not valid.", 400);
  }
  const account = await accountById(userId);
  if (!account) {
    throw new AdminServiceError("No account uses that id.", 404);
  }
  if (!isTestAccountEmail(account.email)) {
    throw new AdminServiceError(
      "Demo data is only for a test account, such as name+test1@example.com.",
      400,
    );
  }
  return account;
}

async function deleteSampleRow(
  admin: SupabaseClient,
  table: "user_budget_plans" | "user_portfolio_plans" | "user_retirement_plans",
  userId: string,
  name: string,
): Promise<void> {
  const { error } = await admin
    .from(table)
    .delete()
    .eq("user_id", userId)
    .filter("data->>name", "eq", name);
  if (error) raise(error, "Could not replace the previous sample.");
}

export async function seedTestAccountDemo(userId: string): Promise<void> {
  const account = await requireTestAccount(userId);
  const admin = adminClient();
  await deleteSampleRow(admin, "user_budget_plans", account.id, SAMPLE_BUDGET_NAME);
  await deleteSampleRow(
    admin,
    "user_portfolio_plans",
    account.id,
    SAMPLE_PORTFOLIO_NAME,
  );
  await deleteSampleRow(
    admin,
    "user_retirement_plans",
    account.id,
    SAMPLE_RETIRE_NAME,
  );

  const { count, error: countError } = await admin
    .from("user_portfolio_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", account.id);
  if (countError) raise(countError, "Could not add the sample portfolio.");

  const dataset = buildSampleDataset({
    portfolioIsPrimary: (count ?? 0) === 0,
  });
  const now = dataset.budget.updatedAt;

  const { error: budgetError } = await admin.from("user_budget_plans").insert({
    id: dataset.budget.id,
    user_id: account.id,
    data: dataset.budget,
    version: 1,
    updated_at: now,
  });
  if (budgetError) raise(budgetError, "Could not add the sample budget.");

  const { error: portfolioError } = await admin
    .from("user_portfolio_plans")
    .insert({
      id: dataset.portfolio.id,
      user_id: account.id,
      data: dataset.portfolio,
      updated_at: now,
    });
  if (portfolioError) raise(portfolioError, "Could not add the sample portfolio.");

  const { error: retireError } = await admin.from("user_retirement_plans").insert({
    id: dataset.retire.id,
    user_id: account.id,
    data: dataset.retire,
    updated_at: now,
  });
  if (retireError) raise(retireError, "Could not add the sample Retire plan.");
}

export async function resetTestAccountData(userId: string): Promise<void> {
  const account = await requireTestAccount(userId);
  const admin = adminClient();
  for (const table of TEST_ACCOUNT_RESET_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", account.id);
    if (error) raise(error, "Could not reset that test account.");
  }
}
