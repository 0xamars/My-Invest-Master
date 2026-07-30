import { RequireAuth } from "@/components/auth/require-auth";
import { MarketInsightsContent } from "@/components/market/market-insights-content";

export default function MarketPage() {
  return (
    <RequireAuth
      title="Sign in to explore Market Insights"
      description="AI-powered themes and quality-screened stock ideas are available after you sign in."
    >
      <MarketInsightsContent />
    </RequireAuth>
  );
}
