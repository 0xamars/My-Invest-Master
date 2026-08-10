-- Allow street consensus (price targets + grades) and other warehouse
-- datasets written to company_metrics after the original 008 check.

alter table public.company_metrics
  drop constraint if exists company_metrics_dataset_check;

alter table public.company_metrics
  add constraint company_metrics_dataset_check
  check (
    dataset in (
      'key_metrics',
      'key_metrics_ttm',
      'key_metrics_annual',
      'financial_scores',
      'enterprise_values',
      'owner_earnings',
      'growth',
      'estimates',
      'street_consensus',
      'investor_events',
      'peers',
      'dcf',
      'ratios_ttm',
      'ratios_annual'
    )
  );
