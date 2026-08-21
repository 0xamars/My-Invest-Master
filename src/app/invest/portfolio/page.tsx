import { PortfolioPlansListContent } from "@/components/portfolio/portfolio-plans-list-content";
import { RequireAuth } from "@/components/auth/require-auth";

export default function InvestPortfolioPage() {
  return (
    <RequireAuth>
      <PortfolioPlansListContent />
    </RequireAuth>
  );
}
