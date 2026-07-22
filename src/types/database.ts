import type { DisplayCurrency } from "@/types/currency";
import type { OptionsPosition } from "@/types/options";
import type { PortfolioHolding } from "@/types/portfolio";

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
      user_preferences: {
        Row: {
          user_id: string;
          display_currency: DisplayCurrency;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_currency?: DisplayCurrency;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_currency?: DisplayCurrency;
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
