export type PlaidEnv = "sandbox" | "development" | "production";

export type PlaidConfig = {
  clientId: string;
  secret: string;
  env: PlaidEnv;
  webhookUrl: string | null;
  redirectUri: string | null;
};

const PLAID_HOST: Record<PlaidEnv, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};

export function parsePlaidEnv(raw: string | undefined | null): PlaidEnv {
  const value = raw?.trim().toLowerCase();
  if (value === "production" || value === "development") return value;
  return "sandbox";
}

export function readPlaidConfig(): PlaidConfig | null {
  const clientId = process.env.PLAID_CLIENT_ID?.trim() ?? "";
  const secret = process.env.PLAID_SECRET?.trim() ?? "";
  if (!clientId || !secret) return null;
  return {
    clientId,
    secret,
    env: parsePlaidEnv(process.env.PLAID_ENV),
    webhookUrl: webhookUrlFromEnv(),
    redirectUri: process.env.PLAID_REDIRECT_URI?.trim() || null,
  };
}

export function isPlaidConfigured(): boolean {
  return readPlaidConfig() != null;
}

export function isPlaidStorageReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function plaidHost(env: PlaidEnv): string {
  return PLAID_HOST[env];
}

export function webhookUrlFromEnv(): string | null {
  const explicit = process.env.PLAID_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return `${site.replace(/\/$/, "")}/api/plaid/webhook`;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}/api/plaid/webhook`;
  return null;
}
