-- Optimistic concurrency for whole-plan budget saves.
-- Existing rows start at version 1. A save updates the row only when
-- version still matches the one the client loaded.

alter table public.user_budget_plans
  add column if not exists version bigint not null default 1;

comment on column public.user_budget_plans.version is
  'Increments on each successful save. Clients send the version they loaded; a mismatch is a conflict and must not overwrite the row.';
