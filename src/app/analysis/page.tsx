import { RequireAuth } from "@/components/auth/require-auth";
import { AnalysisHubContent } from "@/components/analysis/analysis-hub-content";

export default function AnalysisPage() {
  return (
    <RequireAuth>
      <AnalysisHubContent />
    </RequireAuth>
  );
}
