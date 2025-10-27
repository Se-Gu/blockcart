-- Creates a function that evaluates an approved receipt against active campaigns
-- and returns the best matching campaign with the computed reward amount.
create or replace function public.match_active_campaigns(p_receipt_id uuid)
returns table (
  campaign_id uuid,
  amount numeric,
  description text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_record record;
  receipt_total numeric := 0;
  receipt_store text := null;
  receipt_items jsonb := '[]'::jsonb;
  receipt_item_names text[] := '{}';
  receipt_item_brands text[] := '{}';
  receipt_date date := current_date;
  user_age integer := null;
  user_gender text := null;
  best_campaign_id uuid := null;
  best_amount numeric := 0;
  best_description text := null;
  best_weight integer := -1;
  candidate record;
  candidate_rules jsonb;
  candidate_weight integer;
  candidate_amount numeric;
  required_items text[];
  required_brands text[];
  allowed_stores text[];
  excluded_stores text[];
  allowed_genders text[];
  min_total numeric;
  max_total numeric;
  min_age integer;
  max_age integer;
  evaluation_date date := current_date;
  reviewed_total text := null;
  store_from_review text := null;
begin
  select
    r.store,
    r.total,
    r.receipt_date,
    r.created_at,
    r.reviewed_fields ->> 'store' as reviewed_store,
    r.reviewed_fields ->> 'total' as reviewed_total_text,
    coalesce(r.reviewed_fields -> 'items', r.extracted_fields -> 'items', '[]'::jsonb) as items,
    u.kyc_age,
    u.kyc_sex
  into receipt_record
  from public.receipts r
  left join public.users u on u.id = r.user_id
  where r.id = p_receipt_id;

  if not found then
    return;
  end if;

  reviewed_total := receipt_record.reviewed_total_text;
  store_from_review := receipt_record.reviewed_store;

  if reviewed_total is not null and reviewed_total !~ '^[-]?[0-9]*\.?[0-9]+$' then
    reviewed_total := null;
  end if;

  receipt_total := coalesce(
    receipt_record.total,
    case
      when reviewed_total is not null then reviewed_total::numeric
      else null
    end,
    0
  );

  receipt_store := nullif(trim(coalesce(receipt_record.store, store_from_review)), '');
  receipt_date := coalesce(receipt_record.receipt_date, receipt_record.created_at::date, current_date);
  user_age := receipt_record.kyc_age;
  user_gender := nullif(trim(coalesce(receipt_record.kyc_sex, '')), '');
  evaluation_date := receipt_date;

  if receipt_record.items is not null and jsonb_typeof(receipt_record.items) = 'array' then
    receipt_items := receipt_record.items;
  end if;

  select
    coalesce(array_remove(array_agg(lower(trim(item_name))), null), '{}'),
    coalesce(array_remove(array_agg(lower(trim(item_brand))), null), '{}')
  into
    receipt_item_names,
    receipt_item_brands
  from (
    select
      value ->> 'name' as item_name,
      value ->> 'brand' as item_brand
    from jsonb_array_elements(receipt_items) value
  ) as extracted
  where
    (item_name is not null and trim(item_name) <> '')
    or (item_brand is not null and trim(item_brand) <> '');

  for candidate in
    select
      c.*
    from public.campaigns c
    where
      c.status = 'active'
      and (c.start_date is null or c.start_date <= evaluation_date)
      and (c.end_date is null or c.end_date >= evaluation_date)
      and (c.max_participants is null or c.current_participants < c.max_participants)
    order by c.updated_at desc
  loop
    candidate_rules := coalesce(candidate.rule_json, '{}'::jsonb);
    candidate_weight := coalesce((candidate_rules ->> 'priority')::integer, 0);

    allowed_stores := coalesce((
      select array_agg(lower(trim(value)))
      from jsonb_array_elements_text(candidate_rules -> 'stores') value
      where trim(value) <> ''
    ), '{}');

    excluded_stores := coalesce((
      select array_agg(lower(trim(value)))
      from jsonb_array_elements_text(candidate_rules -> 'excluded_stores') value
      where trim(value) <> ''
    ), '{}');

    min_total := null;
    max_total := null;
    if candidate_rules ? 'min_total' then
      min_total := (candidate_rules ->> 'min_total')::numeric;
    end if;
    if candidate_rules ? 'max_total' then
      max_total := (candidate_rules ->> 'max_total')::numeric;
    end if;

    min_age := null;
    max_age := null;
    if candidate_rules ? 'min_age' then
      min_age := (candidate_rules ->> 'min_age')::integer;
    end if;
    if candidate_rules ? 'max_age' then
      max_age := (candidate_rules ->> 'max_age')::integer;
    end if;

    allowed_genders := coalesce((
      select array_agg(lower(trim(value)))
      from jsonb_array_elements_text(candidate_rules -> 'allowed_genders') value
      where trim(value) <> ''
    ), '{}');

    required_items := coalesce((
      select array_agg(lower(trim(value)))
      from jsonb_array_elements_text(candidate_rules -> 'required_items') value
      where trim(value) <> ''
    ), '{}');

    required_brands := coalesce((
      select array_agg(lower(trim(value)))
      from jsonb_array_elements_text(candidate_rules -> 'required_brands') value
      where trim(value) <> ''
    ), '{}');

    -- store filters
    if array_length(allowed_stores, 1) is not null then
      if receipt_store is null or not (lower(receipt_store) = any(allowed_stores)) then
        continue;
      end if;
    end if;

    if array_length(excluded_stores, 1) is not null then
      if receipt_store is not null and lower(receipt_store) = any(excluded_stores) then
        continue;
      end if;
    end if;

    -- total filters
    if min_total is not null and receipt_total < min_total then
      continue;
    end if;

    if max_total is not null and receipt_total > max_total then
      continue;
    end if;

    -- demographics
    if min_age is not null then
      if user_age is null or user_age < min_age then
        continue;
      end if;
    end if;

    if max_age is not null then
      if user_age is null or user_age > max_age then
        continue;
      end if;
    end if;

    if array_length(allowed_genders, 1) is not null then
      if user_gender is null or lower(user_gender) <> any(allowed_genders) then
        continue;
      end if;
    end if;

    -- required items
    if array_length(required_items, 1) is not null then
      if receipt_item_names is null or not (required_items <@ receipt_item_names) then
        continue;
      end if;
    end if;

    if array_length(required_brands, 1) is not null then
      if receipt_item_brands is null or not (required_brands <@ receipt_item_brands) then
        continue;
      end if;
    end if;

    candidate_amount := coalesce(candidate.reward_amount, receipt_total * coalesce(candidate.multiplier, 1));
    if candidate_amount is null or candidate_amount <= 0 then
      candidate_amount := 0;
    end if;

    if candidate_amount > best_amount or (candidate_amount = best_amount and candidate_weight > best_weight) then
      best_campaign_id := candidate.id;
      best_amount := candidate_amount;
      best_description := coalesce(candidate.description, candidate.name, candidate.brand);
      best_weight := candidate_weight;
    end if;
  end loop;

  if best_campaign_id is not null and best_amount > 0 then
    campaign_id := best_campaign_id;
    amount := round(best_amount::numeric, 2);
    description := best_description;
    return next;
  end if;
end;
$$;

grant execute on function public.match_active_campaigns(uuid) to authenticated;
grant execute on function public.match_active_campaigns(uuid) to service_role;

-- Utility function to adjust campaign participants safely.
create or replace function public.adjust_campaign_participants(p_campaign_id uuid, p_delta integer)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_record public.campaigns;
  new_total integer;
begin
  select * into campaign_record
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'Campaign % not found', p_campaign_id;
  end if;

  new_total := coalesce(campaign_record.current_participants, 0) + coalesce(p_delta, 0);

  if new_total < 0 then
    new_total := 0;
  end if;

  if p_delta > 0 and campaign_record.max_participants is not null and new_total > campaign_record.max_participants then
    raise exception 'Campaign % has reached maximum participants', p_campaign_id;
  end if;

  update public.campaigns
  set current_participants = new_total,
      updated_at = now()
  where id = p_campaign_id
  returning * into campaign_record;

  return campaign_record;
end;
$$;

grant execute on function public.adjust_campaign_participants(uuid, integer) to service_role;

do $$
declare
  test_user uuid := gen_random_uuid();
  test_receipt uuid := gen_random_uuid();
  campaign_a uuid := gen_random_uuid();
  campaign_b uuid := gen_random_uuid();
  match_result record;
  updated_campaign record;
begin
  insert into public.users(id, email, kyc_age, kyc_sex, created_at, updated_at)
  values (test_user, 'match-test@example.com', 30, 'female', now(), now());

  insert into public.receipts(id, user_id, store, total, receipt_date, status, created_at, updated_at, reviewed_fields)
  values (
    test_receipt,
    test_user,
    'Fresh Market',
    75.25,
    current_date,
    'approved',
    now(),
    now(),
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('name', 'Organic Apples', 'brand', 'FreshCo', 'price', 5.50),
        jsonb_build_object('name', 'Almond Milk', 'brand', 'Nutty', 'price', 4.75)
      )
    )
  );

  insert into public.campaigns(id, brand, name, rule_json, multiplier, reward_amount, max_participants, current_participants, status, start_date, created_at, updated_at)
  values (
    campaign_a,
    'FreshCo',
    'Fresh Market Bonus',
    jsonb_build_object(
      'stores', jsonb_build_array('Fresh Market'),
      'required_brands', jsonb_build_array('FreshCo'),
      'min_total', 50
    ),
    1.5,
    null,
    100,
    10,
    'active',
    current_date - 1,
    now(),
    now()
  ), (
    campaign_b,
    'Corner Store',
    'Corner Saver',
    jsonb_build_object(
      'stores', jsonb_build_array('Corner Store'),
      'min_total', 20
    ),
    1,
    20,
    100,
    0,
    'active',
    current_date - 1,
    now(),
    now()
  );

  select * into match_result from public.match_active_campaigns(test_receipt);

  if match_result.campaign_id is distinct from campaign_a then
    raise exception 'Expected campaign % but got %', campaign_a, match_result.campaign_id;
  end if;

  if match_result.amount <= 0 then
    raise exception 'Expected positive reward amount, received %', match_result.amount;
  end if;

  select * into updated_campaign from public.adjust_campaign_participants(campaign_a, 1);

  if coalesce(updated_campaign.current_participants, 0) <> 11 then
    raise exception 'Expected participant count 11 but received %', updated_campaign.current_participants;
  end if;

  delete from public.rewards where receipt_id = test_receipt;
  delete from public.receipts where id = test_receipt;
  delete from public.campaigns where id in (campaign_a, campaign_b);
  delete from public.users where id = test_user;
exception
  when others then
    delete from public.rewards where receipt_id = test_receipt;
    delete from public.receipts where id = test_receipt;
    delete from public.campaigns where id in (campaign_a, campaign_b);
    delete from public.users where id = test_user;
    raise;
end;
$$;
