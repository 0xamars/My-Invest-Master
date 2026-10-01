"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminFlagState } from "@/lib/admin/flag-state";
import type { UserHealth } from "@/lib/admin/health";

type LookupResult = {
  health: UserHealth;
  flags: AdminFlagState[];
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function planLabel(plan: UserHealth["plan"]): string {
  if (plan === "premium") return "Premium";
  if (plan === "free") return "Free";
  return "Unknown";
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) return body.error;
  } catch {
    // Fall through to a generic sentence.
  }
  return "That request did not finish.";
}

export function AdminConsole({
  signedInEmail,
  signedInCanSeed,
}: {
  signedInEmail: string;
  signedInCanSeed: boolean;
}) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(nextEmail: string, options?: { keepNotice?: boolean }) {
    setBusy(true);
    setError(null);
    if (!options?.keepNotice) setNotice(null);
    try {
      const response = await fetch("/api/admin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });
      if (!response.ok) {
        setResult(null);
        setError(await readError(response));
        return;
      }
      setResult((await response.json()) as LookupResult);
    } catch {
      setError("That request did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function setFlag(flag: AdminFlagState, enabled: boolean | null) {
    if (!result) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: result.health.userId,
          flag: flag.id,
          enabled,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const body = (await response.json()) as { flags: AdminFlagState[] };
      setResult({ ...result, flags: body.flags });
    } catch {
      setError("That request did not finish.");
    } finally {
      setBusy(false);
    }
  }

  async function runDemo(action: "seed" | "reset") {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reset" ? { action, confirm: "reset" } : { action },
        ),
      });
      const body = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(body.error ?? "That request did not finish.");
        return;
      }
      setNotice(body.message ?? "Done.");
      if (
        result &&
        email.trim() &&
        result.health.email.toLowerCase() === signedInEmail.trim().toLowerCase()
      ) {
        await lookup(email, { keepNotice: true });
      }
    } catch {
      setError("That request did not finish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="page-title">Admin</h1>
        <p className="page-description">
          Turn features on for one account, and check account health without
          opening their transactions, balances, holdings, or bank links.
        </p>
      </div>

      {signedInCanSeed ? (
        <DemoCard
          title="This signed-in account"
          detail={signedInEmail}
          busy={busy}
          onSeed={() => runDemo("seed")}
          onReset={() => runDemo("reset")}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Look up an account</CardTitle>
          <CardDescription>
            Search by the email they used to sign up. Each search is recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(email);
            }}
          >
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <Button type="submit" disabled={busy || email.trim().length === 0}>
              Look up
            </Button>
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </CardContent>
      </Card>

      {result ? (
        <>
          <HealthCard health={result.health} />
          <Card>
            <CardHeader>
              <CardTitle>Feature flags</CardTitle>
              <CardDescription>
                On and off apply only to {result.health.email}. Use server
                setting clears a saved choice.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {result.flags.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  busy={busy}
                  onChange={(enabled) => setFlag(flag, enabled)}
                />
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function HealthCard({ health }: { health: UserHealth }) {
  const rows: Array<[string, string]> = [
    ["Email", health.email],
    ["Account created", formatWhen(health.createdAt)],
    ["Plan", planLabel(health.plan)],
    ["Budget plans", String(health.budgetPlans)],
    ["Accounts", String(health.accounts)],
    ["Transactions", String(health.transactions)],
    ["Portfolios", String(health.portfolios)],
    ["Retire plans", String(health.retirePlans)],
    ["Last activity", formatWhen(health.lastActivity)],
    ["Recent errors", health.errorsNote],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account health</CardTitle>
        <CardDescription>
          Counts only. This view does not show transaction details, balances,
          holdings, or bank links.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function FlagRow({
  flag,
  busy,
  onChange,
}: {
  flag: AdminFlagState;
  busy: boolean;
  onChange: (enabled: boolean | null) => void;
}) {
  const mode = flag.override === null ? "default" : flag.override ? "on" : "off";
  const serverLine =
    flag.kind === "fmp_display"
      ? flag.serverOn
        ? "Market data gate is on."
        : "Market data gate is off. Market data stays available to every account until the gate is on."
      : flag.serverOn
        ? "Server setting is on for every account."
        : "Server setting is off.";
  const resultLine =
    flag.effective === true
      ? "This account has it on."
      : flag.effective === false
        ? "This account has it off."
        : null;

  return (
    <div className="flex flex-col gap-3 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <div>
        <h2 className="text-sm font-medium">{flag.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>
        <p className="mt-2 text-sm">{serverLine}</p>
        {resultLine ? <p className="text-sm">{resultLine}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "default" ? "default" : "outline"}
          disabled={busy}
          aria-pressed={mode === "default"}
          onClick={() => onChange(null)}
        >
          Use server setting
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "on" ? "default" : "outline"}
          disabled={busy}
          aria-pressed={mode === "on"}
          onClick={() => onChange(true)}
        >
          On for this person
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "off" ? "default" : "outline"}
          disabled={busy}
          aria-pressed={mode === "off"}
          onClick={() => onChange(false)}
        >
          Off for this person
        </Button>
      </div>
    </div>
  );
}

function DemoCard({
  title,
  detail,
  busy,
  onSeed,
  onReset,
}: {
  title: string;
  detail: string;
  busy: boolean;
  onSeed: () => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {detail}. Sample names start with Sample. Amounts are placeholders,
          not a forecast or advice. Reset removes this account&apos;s budgets,
          portfolios, watchlists, and Retire plans. It does not delete the
          sign-in, the plan tier, or bank links.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={onSeed}>
          Add sample data
        </Button>
        {confirmReset ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setConfirmReset(false);
              onReset();
            }}
          >
            Confirm reset
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmReset(true)}
          >
            Reset this account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
