-- Payee rules live on each budget plan document as data.payeeRules.
-- Categories, transactions, and rules share one JSON plan so import, undo,
-- and cloud save stay a single write. This check keeps the list an array.
--
-- Each entry:
--   match        text compared to the imported payee (case-insensitive)
--   matchType    contains | starts-with | exact
--   renameTo     payee name to store (existing or new)
--   categoryId   optional spending category
--   memo         optional
--   priority     lower number wins
--   enabled      boolean

alter table public.user_budget_plans
  drop constraint if exists user_budget_plans_payee_rules_array;

alter table public.user_budget_plans
  add constraint user_budget_plans_payee_rules_array
  check (
    not (data ? 'payeeRules')
    or jsonb_typeof(data -> 'payeeRules') = 'array'
  );

comment on constraint user_budget_plans_payee_rules_array
  on public.user_budget_plans is
  'data.payeeRules is an array of contains/starts-with/exact rename rules with optional category, memo, priority, and enabled.';
