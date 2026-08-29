"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { UserPreferencesProvider } from "@/hooks/use-user-preferences";
import { PortfolioPlansProvider } from "@/contexts/portfolio-plans-context";
import { WatchlistPlansProvider } from "@/contexts/watchlist-plans-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <UserPreferencesProvider>
          <PortfolioPlansProvider>
            <WatchlistPlansProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </WatchlistPlansProvider>
          </PortfolioPlansProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
