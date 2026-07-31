import { RequireAuth } from "@/components/auth/require-auth";
import { WatchlistContent } from "@/components/watchlist/watchlist-content";

interface WatchlistDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WatchlistDetailPage({
  params,
}: WatchlistDetailPageProps) {
  const { id } = await params;

  return (
    <RequireAuth>
      <WatchlistContent listId={id} />
    </RequireAuth>
  );
}
