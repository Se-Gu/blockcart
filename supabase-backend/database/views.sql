create view public.mobile_users as
select
  u.id,
  u.email,
  u.wallet_address,
  u.kyc_age,
  u.kyc_sex,
  u.referral_code,
  u.referred_by,
  u.created_at,
  u.updated_at
from
  users u
  left join web_users wu on wu.id = u.id
where
  wu.id is null;

create view public.receipt_market_data as
select
  id,
  user_id,
  store,
  location,
  payment_method,
  receipt_date,
  receipt_time,
  total,
  jsonb_path_query(extracted_fields, '$."items"[*]'::jsonpath) as item,
  created_at,
  updated_at
from
  receipts r
where
  status = 'approved'::text;

create view public.user_balances as
select
  user_id,
  COALESCE(sum(amount), 0::numeric) as total_balance
from
  rewards
group by
  user_id;

create view public.web_user_profiles as
select
  wu.id,
  wu.role,
  wu.created_at,
  wu.updated_at,
  au.email,
  au.raw_user_meta_data ->> 'full_name'::text as full_name
from
  web_users wu
  join auth.users au on au.id = wu.id;

