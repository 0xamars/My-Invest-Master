import type { Metadata } from "next";
import { PricingContent } from "@/components/pricing/pricing-content";

export const metadata: Metadata = {
  title: "Pricing · InvestSalsa",
  description:
    "Compare InvestSalsa Free and Premium plans — portfolios, retirement, budget, AI, and market insights.",
};

export default function PricingPage() {
  return <PricingContent />;
}
