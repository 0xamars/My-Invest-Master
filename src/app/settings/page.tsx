import { RequireAuth } from "@/components/auth/require-auth";
import { PillarBackLink } from "@/components/layout/pillar-back-link";
import { AccountSettings } from "@/components/settings/account-settings";
import { DataSettingsCard } from "@/components/settings/data-settings-card";
import { DisplayCurrencyCard } from "@/components/settings/display-currency-card";
import { PlanSettingsCard } from "@/components/settings/plan-settings-card";
import { BUDGET_PATH } from "@/lib/chrome/nav";

export default function SettingsPage() {
  return (
    <RequireAuth
      title="Sign in to open Settings"
      description="Account and plan settings are tied to your sign-in."
    >
      <div className="flex flex-1 flex-col gap-8">
        <div>
          <PillarBackLink href={BUDGET_PATH} label="Back to Budget" />
          <h1 className="page-title mt-2">Settings</h1>
          <p className="page-description">
            Manage account and cloud sync for your portfolio data.
          </p>
        </div>
        <AccountSettings />
        <DisplayCurrencyCard />
        <DataSettingsCard />
        <PlanSettingsCard />
      </div>
    </RequireAuth>
  );
}
