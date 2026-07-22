import { AccountSettings } from "@/components/settings/account-settings";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-description">
          Manage account and cloud sync for your portfolio data.
        </p>
      </div>
      <AccountSettings />
    </div>
  );
}
