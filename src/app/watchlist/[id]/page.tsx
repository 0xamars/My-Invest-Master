import { redirect } from "next/navigation";
import { investWatchlistPath } from "@/lib/chrome/nav";

interface WatchlistAliasPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchlistAliasPage({
  params,
}: WatchlistAliasPageProps) {
  const { id } = await params;
  redirect(investWatchlistPath(id));
}
