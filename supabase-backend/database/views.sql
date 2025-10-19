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
  wu.email,
  wu.role,
  wu.created_at,
  wu.updated_at,
  COALESCE(
    au.raw_user_meta_data ->> 'full_name'::text,
    wu.email
  ) as full_name,
  au.last_sign_in_at as last_login,
  au.invited_at,
  au.email_confirmed_at
from
  web_users wu
  join auth.users au on au.id = wu.id;

create view public.analytics_overview as
with totals as (
  select
    count(*)::bigint as total_receipts,
    count(*) filter (
      where status in ('pending'::text, 'pending_review'::text)
    )::bigint as pending_receipts,
    count(*) filter (where status = 'approved'::text)::bigint as approved_receipts,
    count(*) filter (where status = 'rejected'::text)::bigint as rejected_receipts
  from
    receipts
),
processing as (
  select
    avg(extract(epoch from (completed_at - assigned_at)) / 3600)::double precision as avg_processing_time_hours
  from
    receipt_assignments
  where
    completed_at is not null
    and assigned_at is not null
),
reward_totals as (
  select
    coalesce(sum(amount), 0)::double precision as rewards_issued
  from
    rewards
)
select
  totals.total_receipts,
  totals.pending_receipts,
  case
    when totals.approved_receipts + totals.rejected_receipts > 0 then totals.approved_receipts::double precision / (totals.approved_receipts + totals.rejected_receipts)
    else 0::double precision
  end as approval_rate,
  coalesce(processing.avg_processing_time_hours, 0::double precision) as avg_processing_time_hours,
  reward_totals.rewards_issued
from
  totals,
  processing,
  reward_totals;

create view public.analytics_receipt_trends as
with days as (
  select
    generate_series((current_date - '6 days'::interval), current_date, '1 day'::interval)::date as day
),
submissions as (
  select
    created_at::date as day,
    count(*)::bigint as submitted
  from
    receipts
  group by
    created_at::date
),
approvals as (
  select
    updated_at::date as day,
    count(*)::bigint as approved
  from
    receipts
  where
    status = 'approved'::text
  group by
    updated_at::date
),
rejections as (
  select
    updated_at::date as day,
    count(*)::bigint as rejected
  from
    receipts
  where
    status = 'rejected'::text
  group by
    updated_at::date
)
select
  days.day as bucket_date,
  to_char(days.day, 'Mon DD') as date_label,
  coalesce(submissions.submitted, 0)::bigint as submitted,
  coalesce(approvals.approved, 0)::bigint as approved,
  coalesce(rejections.rejected, 0)::bigint as rejected
from
  days
  left join submissions on submissions.day = days.day
  left join approvals on approvals.day = days.day
  left join rejections on rejections.day = days.day
order by
  days.day;

create view public.analytics_reward_breakdown as
select
  coalesce(c.brand, 'Unattributed'::text) as label,
  coalesce(sum(r.amount), 0)::double precision as value
from
  rewards r
  left join campaigns c on c.id = r.campaign_id
group by
  coalesce(c.brand, 'Unattributed'::text)
having
  coalesce(sum(r.amount), 0) <> 0
order by
  value desc;

create view public.analytics_reviewer_performance as
with monthly_assignments as (
  select
    reviewer_id,
    extract(epoch from (completed_at - assigned_at)) / 60 as review_time_minutes
  from
    receipt_assignments
  where
    status = 'completed'::text
    and completed_at is not null
    and assigned_at is not null
    and date_trunc('month', completed_at) = date_trunc('month', now())
),
monthly_reviews as (
  select
    reviewer_id,
    receipt_id,
    action
  from
    receipt_reviews
  where
    date_trunc('month', created_at) = date_trunc('month', now())
)
select
  wu.id as reviewer_id,
  coalesce(wp.full_name, wp.email, 'Reviewer'::text) as reviewer_name,
  coalesce(count(distinct monthly_reviews.receipt_id), 0)::bigint as reviewed,
  coalesce(avg(case when monthly_reviews.action = 'approve'::text then 1 else 0 end), 0)::double precision as approval_rate,
  coalesce(avg(monthly_assignments.review_time_minutes), 0)::double precision as avg_review_time_minutes
from
  web_users wu
  join web_user_profiles wp on wp.id = wu.id
  left join monthly_reviews on monthly_reviews.reviewer_id = wu.id
  left join monthly_assignments on monthly_assignments.reviewer_id = wu.id
group by
  wu.id,
  coalesce(wp.full_name, wp.email, 'Reviewer'::text)
having
  coalesce(count(distinct monthly_reviews.receipt_id), 0) > 0
  or coalesce(count(monthly_assignments.reviewer_id), 0) > 0
order by
  reviewed desc,
  reviewer_name;

create view public.maintenance_overview as
select
  ms.maintenance_mode,
  ms.last_maintenance_at,
  ms.last_aggregator_sync,
  ms.supabase_status,
  ms.analytics_status,
  ms.app_version,
  ms.updated_at
from
  maintenance_state ms;

create view public.maintenance_task_status as
select
  mt.id,
  mt.name,
  mt.description,
  mt.last_run_at,
  mt.status,
  mt.updated_at
from
  maintenance_tasks mt;

