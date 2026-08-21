import { redirect } from "next/navigation";
import { INVEST_PORTFOLIO_PATH } from "@/lib/chrome/nav";

export default function PortfolioPage() {
  redirect(INVEST_PORTFOLIO_PATH);
}
