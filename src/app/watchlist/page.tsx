import { RequireAuth } from "@/components/auth/require-auth";
import { WatchlistPlansListContent } from "@/components/watchlist/watchlist-plans-list-content";

export default function WatchlistPage() {
  return (
    <RequireAuth>
      <WatchlistPlansListContent />
    </RequireAuth>
  );
}
