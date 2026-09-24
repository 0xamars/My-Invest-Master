-- Backfill Retire account fields on existing plan documents.
-- Balances, symbols, quantities, ages, and income amounts are left as saved.
-- Missing account types default to non-registered, or cash when the holding
-- is already cash. Missing owners default to person 1. Missing contributions
-- and the pension split default to zero so old plans do not gain income.

update public.user_retirement_plans
set data = jsonb_set(
  data,
  '{assets}',
  (
    select coalesce(
      jsonb_agg(
        case
          when jsonb_typeof(asset) <> 'object' then asset
          else asset || jsonb_build_object(
            'accountKind',
            coalesce(
              asset->>'accountKind',
              case
                when asset->>'type' = 'cash' then 'cash'
                else 'non_registered'
              end
            ),
            'owner',
            coalesce(asset->>'owner', 'person1'),
            'annualContribution',
            case
              when jsonb_typeof(asset->'annualContribution') = 'number'
                then asset->'annualContribution'
              else '0'::jsonb
            end
          )
        end
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(data->'assets') as asset
  ),
  true
)
where jsonb_typeof(data->'assets') = 'array';

update public.user_retirement_plans
set data = jsonb_set(
  data,
  '{incomeStreams}',
  (
    select coalesce(
      jsonb_agg(
        case
          when jsonb_typeof(stream) <> 'object' then stream
          else stream || jsonb_build_object(
            'owner',
            coalesce(stream->>'owner', 'person1'),
            'survivorPercent',
            case
              when jsonb_typeof(stream->'survivorPercent') = 'number'
                then stream->'survivorPercent'
              else '0'::jsonb
            end
          )
        end
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(data->'incomeStreams') as stream
  ),
  true
)
where jsonb_typeof(data->'incomeStreams') = 'array';

update public.user_retirement_plans
set data = jsonb_set(data, '{pensionSplitPercent}', '0'::jsonb, true)
where not (data ? 'pensionSplitPercent');

comment on table public.user_retirement_plans is
  'One JSON plan per row. Assets may include accountKind (rrsp, tfsa, non_registered, cash), owner (person1 or person2), and annualContribution. Income streams may include owner and survivorPercent. pensionSplitPercent is 0-50 and does not change the household total.';
