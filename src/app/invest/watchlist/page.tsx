import { RequireAuth } from "@/components/auth/require-auth";
import { WatchlistPlansListContent } from "@/components/watchlist/watchlist-plans-list-content";

export default function InvestWatchlistPage() {
  return (
    <RequireAuth>
      <WatchlistPlansListContent />
    </RequireAuth>
  );
}
