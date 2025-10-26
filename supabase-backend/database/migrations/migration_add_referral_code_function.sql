-- Ensures every user has a referral code by generating one on demand.
create or replace function public.ensure_referral_code(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  new_code text;
begin
  select referral_code into existing_code
  from public.users
  where id = target_user_id
  for update;

  if existing_code is not null then
    return existing_code;
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists(
      select 1 from public.users where referral_code = new_code
    );
  end loop;

  update public.users
  set referral_code = new_code,
      updated_at = now()
  where id = target_user_id;

  return new_code;
end;
$$;

grant execute on function public.ensure_referral_code(uuid) to authenticated;
