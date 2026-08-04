-- Allow empty-marker messaging on data_refresh_state without schema break.
-- status remains ok|stale|error; empty endpoints use status=ok + error_message=fmp_empty.

-- No structural change required; this migration documents the convention.
-- Optionally extend check if you want an explicit 'empty' status:

alter table public.data_refresh_state
  drop constraint if exists data_refresh_state_status_check;

alter table public.data_refresh_state
  add constraint data_refresh_state_status_check
  check (status in ('ok', 'stale', 'error', 'empty'));
