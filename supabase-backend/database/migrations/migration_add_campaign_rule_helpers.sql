-- Document the campaign rule_json schema and introduce helper functions/views
-- for computing eligibility snapshots and campaign configuration support.

-- Describe the supported structure of the rule_json column directly on the
-- campaigns table so that developers can introspect it from psql or the dashboard.
COMMENT ON COLUMN public.campaigns.rule_json IS
  'Structured rules controlling campaign eligibility. Expected keys include:
   {
     "version": 1,
     "reward_type": "multiplier" | "fixed_bonus" | "referral_boost",
     "reward_value": <numeric amount for fixed/bonus rewards>,
     "min_spend": <numeric minimum receipt total>,
     "eligible_stores": ["Store A", "Store B"],
     "multiplier_overrides": { "double_base": true, "stack_with_existing": false },
     "demographics": { "age_min": 18, "age_max": 35, "genders": ["female"], "kyc_verified": true },
     "referral": { "required": true, "bonus_amount": 5 }
   }
   Additional vendor specific keys are preserved but ignored by the helper
   eligibility functions.';

-- Helper function that evaluates a receipt/user tuple against a campaign rule.
CREATE OR REPLACE FUNCTION public.campaign_rule_matches(
  rule jsonb,
  receipt_total numeric,
  receipt_store text,
  receipt_date date,
  user_age integer,
  user_sex text,
  user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  min_spend numeric;
  store_allowed boolean := true;
  demographics jsonb;
  selected_store text;
  selected_gender text;
BEGIN
  IF rule IS NULL THEN
    RETURN true;
  END IF;

  IF rule ? 'min_spend' THEN
    min_spend := NULLIF(rule->>'min_spend', '')::numeric;
    IF min_spend IS NOT NULL AND (receipt_total IS NULL OR receipt_total < min_spend) THEN
      RETURN false;
    END IF;
  END IF;

  IF jsonb_typeof(rule->'eligible_stores') = 'array' THEN
    IF jsonb_array_length(rule->'eligible_stores') > 0 THEN
      store_allowed := false;
      FOR selected_store IN SELECT jsonb_array_elements_text(rule->'eligible_stores') LOOP
        IF receipt_store IS NOT NULL AND receipt_store ILIKE selected_store THEN
          store_allowed := true;
          EXIT;
        END IF;
      END LOOP;
      IF store_allowed IS FALSE THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  demographics := rule->'demographics';
  IF demographics IS NOT NULL THEN
    IF demographics ? 'age_min' THEN
      IF user_age IS NULL OR user_age < (demographics->>'age_min')::integer THEN
        RETURN false;
      END IF;
    END IF;

    IF demographics ? 'age_max' THEN
      IF user_age IS NULL OR user_age > (demographics->>'age_max')::integer THEN
        RETURN false;
      END IF;
    END IF;

    IF jsonb_typeof(demographics->'genders') = 'array' THEN
      IF jsonb_array_length(demographics->'genders') > 0 THEN
        store_allowed := false;
        FOR selected_gender IN SELECT jsonb_array_elements_text(demographics->'genders') LOOP
          IF user_sex IS NOT NULL AND lower(user_sex) = lower(selected_gender) THEN
            store_allowed := true;
            EXIT;
          END IF;
        END LOOP;
        IF store_allowed IS FALSE THEN
          RETURN false;
        END IF;
      END IF;
    END IF;

    IF demographics ? 'kyc_verified' THEN
      IF (demographics->>'kyc_verified')::boolean IS TRUE AND user_id IS NULL THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Live preview of eligibility for an arbitrary rule payload.
CREATE OR REPLACE FUNCTION public.preview_campaign_rule(rule jsonb)
RETURNS TABLE (
  eligible_receipts bigint,
  eligible_users bigint,
  total_receipts bigint,
  total_users bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH receipt_base AS (
    SELECT
      r.id,
      r.total,
      r.store,
      r.receipt_date,
      r.user_id,
      u.kyc_age,
      u.kyc_sex
    FROM public.receipts r
    LEFT JOIN public.users u ON u.id = r.user_id
    WHERE r.status = 'approved'
  )
  SELECT
    COUNT(DISTINCT CASE WHEN public.campaign_rule_matches(rule, total, store, receipt_date, kyc_age, kyc_sex, user_id) THEN id END) AS eligible_receipts,
    COUNT(DISTINCT CASE WHEN public.campaign_rule_matches(rule, total, store, receipt_date, kyc_age, kyc_sex, user_id) THEN user_id END) AS eligible_users,
    COUNT(DISTINCT id) AS total_receipts,
    COUNT(DISTINCT user_id) AS total_users
  FROM receipt_base;
$$;

-- Snapshot view that exposes eligibility metrics for every stored campaign.
CREATE OR REPLACE VIEW public.campaign_eligibility_snapshots AS
SELECT
  c.id AS campaign_id,
  COUNT(DISTINCT CASE WHEN public.campaign_rule_matches(c.rule_json, r.total, r.store, r.receipt_date, u.kyc_age, u.kyc_sex, r.user_id) THEN r.id END) AS eligible_receipts,
  COUNT(DISTINCT CASE WHEN public.campaign_rule_matches(c.rule_json, r.total, r.store, r.receipt_date, u.kyc_age, u.kyc_sex, r.user_id) THEN r.user_id END) AS eligible_users,
  COUNT(DISTINCT r.id) AS total_receipts,
  COUNT(DISTINCT r.user_id) AS total_users,
  NOW() AS calculated_at
FROM public.campaigns c
LEFT JOIN public.receipts r ON r.receipt_date BETWEEN COALESCE(c.start_date, r.receipt_date) AND COALESCE(c.end_date, r.receipt_date)
  AND r.status = 'approved'
LEFT JOIN public.users u ON u.id = r.user_id
GROUP BY c.id;

-- View that lists available stores to help populate UI selections.
CREATE OR REPLACE VIEW public.campaign_available_stores AS
SELECT DISTINCT
  TRIM(r.store) AS store_name
FROM public.receipts r
WHERE r.store IS NOT NULL AND TRIM(r.store) <> ''
ORDER BY TRIM(r.store);

-- Helper that returns a JSON description of the supported rule schema. This can
-- be rendered in tooling or surfaced in documentation.
CREATE OR REPLACE FUNCTION public.campaign_rule_schema_documentation()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'version', jsonb_build_object('type', 'number', 'description', 'Schema version. Currently 1.'),
    'reward_type', jsonb_build_object(
      'type', 'string',
      'enum', jsonb_build_array('multiplier', 'fixed_bonus', 'referral_boost'),
      'description', 'Determines how rewards are calculated for qualifying receipts.'
    ),
    'reward_value', jsonb_build_object(
      'type', 'number',
      'description', 'Optional numeric bonus used with fixed_bonus and referral_boost reward types.'
    ),
    'min_spend', jsonb_build_object(
      'type', 'number',
      'description', 'Minimum receipt total required to qualify.'
    ),
    'eligible_stores', jsonb_build_object(
      'type', 'array',
      'items', jsonb_build_object('type', 'string'),
      'description', 'Limits eligibility to the provided list of store names. Empty or omitted means all stores.'
    ),
    'multiplier_overrides', jsonb_build_object(
      'type', 'object',
      'description', 'Flags that control multiplier behaviour for double rewards or stacking rules.',
      'properties', jsonb_build_object(
        'double_base', jsonb_build_object('type', 'boolean', 'description', 'Apply a 2x multiplier on top of the base campaign multiplier.'),
        'stack_with_existing', jsonb_build_object('type', 'boolean', 'description', 'Allow the reward to stack with other active campaigns.')
      )
    ),
    'demographics', jsonb_build_object(
      'type', 'object',
      'description', 'Optional demographic filters applied to the user profile.',
      'properties', jsonb_build_object(
        'age_min', jsonb_build_object('type', 'number'),
        'age_max', jsonb_build_object('type', 'number'),
        'genders', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string')),
        'kyc_verified', jsonb_build_object('type', 'boolean', 'description', 'Require a verified Blockcart identity before issuing rewards.')
      )
    ),
    'referral', jsonb_build_object(
      'type', 'object',
      'description', 'Configuration for referral bonus campaigns.',
      'properties', jsonb_build_object(
        'required', jsonb_build_object('type', 'boolean', 'description', 'Require a referral relationship to qualify.'),
        'bonus_amount', jsonb_build_object('type', 'number', 'description', 'Fixed amount paid when referral requirements are met.')
      )
    )
  );
$$;
