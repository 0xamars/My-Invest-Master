import type { BudgetData, BudgetPlan } from "@/types/budget";
import type { DisplayCurrency } from "@/types/currency";
import type { MoneyProfile } from "@/types/money-profile";
import type { OptionsPosition } from "@/types/options";
import type { UserPlan } from "@/types/plan";
import type { PortfolioHolding, UserPortfolio } from "@/types/portfolio";
import type { RetirementPlan } from "@/types/retirement";
import type { UserWatchlist } from "@/types/watchlist";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_portfolios: {
        Row: {
          user_id: string;
          holdings: PortfolioHolding[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          holdings?: PortfolioHolding[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          holdings?: PortfolioHolding[];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_portfolio_plans: {
        Row: {
          id: string;
          user_id: string;
          data: UserPortfolio;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: UserPortfolio;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: UserPortfolio;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_options: {
        Row: {
          user_id: string;
          positions: OptionsPosition[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          positions?: OptionsPosition[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          positions?: OptionsPosition[];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_money_profiles: {
        Row: {
          user_id: string;
          data: MoneyProfile;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          data: MoneyProfile;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          data?: MoneyProfile;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          display_currency: DisplayCurrency;
          plan: UserPlan;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_currency?: DisplayCurrency;
          plan?: UserPlan;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_currency?: DisplayCurrency;
          plan?: UserPlan;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_retirement_plans: {
        Row: {
          id: string;
          user_id: string;
          data: RetirementPlan;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: RetirementPlan;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: RetirementPlan;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_budget_plans: {
        Row: {
          id: string;
          user_id: string;
          data: BudgetPlan;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: BudgetPlan;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: BudgetPlan;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_budgets: {
        Row: {
          user_id: string;
          data: BudgetData;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          data?: BudgetData;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          data?: BudgetData;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_watchlist_plans: {
        Row: {
          id: string;
          user_id: string;
          data: UserWatchlist;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          data: UserWatchlist;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: UserWatchlist;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
