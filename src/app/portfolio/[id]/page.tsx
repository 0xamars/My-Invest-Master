import { PortfolioContent } from "@/components/portfolio/portfolio-content";
import { RequireAuth } from "@/components/auth/require-auth";

export default function PortfolioDetailPage() {
  return (
    <RequireAuth>
      <PortfolioContent />
    </RequireAuth>
  );
}
