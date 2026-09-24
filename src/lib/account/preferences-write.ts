import type { DisplayCurrency } from "@/types/currency";

/**
 * Columns a signed-in user may write on user_preferences.
 * `plan` is omitted on purpose: migration 015 revokes insert/update on that column.
 */
export function preferencesCloudWrite(input: {
  userId: string;
  displayCurrency: DisplayCurrency;
  updatedAt: string;
}): {
  user_id: string;
  display_currency: DisplayCurrency;
  updated_at: string;
} {
  return {
    user_id: input.userId,
    display_currency: input.displayCurrency,
    updated_at: input.updatedAt,
  };
}
