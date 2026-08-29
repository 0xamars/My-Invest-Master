import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { MarketingHomeContent } from "@/components/home/marketing-home-content";

export const metadata: Metadata = {
  title: "InvestSalsa — Freedom, engineered.",
  description:
    "Budget, Invest, and Freedom. Envelope leftover that carries, a register, and a month close. Portfolio checkup for concentration and mix, plus a Freedom plan with target, on-track verdict, and what-ifs. Not investment advice.",
};

function HomeLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#121212]">
      <RefreshCw className="size-5 animate-spin text-white/50" />
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <MarketingHomeContent />
    </Suspense>
  );
}
