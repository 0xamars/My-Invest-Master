import { OptionsContent } from "@/components/options/options-content";
import { RequireAuth } from "@/components/auth/require-auth";

export default function InvestOptionsPage() {
  return (
    <RequireAuth>
      <OptionsContent />
    </RequireAuth>
  );
}
