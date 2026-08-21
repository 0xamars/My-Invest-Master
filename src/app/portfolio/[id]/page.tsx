import { redirect } from "next/navigation";
import { investPortfolioPath } from "@/lib/chrome/nav";

interface PortfolioAliasPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortfolioAliasPage({
  params,
}: PortfolioAliasPageProps) {
  const { id } = await params;
  redirect(investPortfolioPath(id));
}
