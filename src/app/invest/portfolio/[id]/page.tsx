import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { PortfolioContent } from "@/components/portfolio/portfolio-content";
import { RequireAuth } from "@/components/auth/require-auth";

function PortfolioLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function InvestPortfolioDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<PortfolioLoading />}>
        <PortfolioContent />
      </Suspense>
    </RequireAuth>
  );
}
