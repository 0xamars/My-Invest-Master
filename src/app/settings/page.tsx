import { AccountSettings } from "@/components/settings/account-settings";
import { PlanSettingsCard } from "@/components/settings/plan-settings-card";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">
          Manage account, plan, and cloud sync for your portfolio data.
        </p>
      </div>
      <AccountSettings />
      <PlanSettingsCard />
    </div>
  );
}
