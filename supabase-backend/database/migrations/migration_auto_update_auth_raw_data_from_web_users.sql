-- 1️⃣ Function to sync role + user_type into auth.users metadata
create or replace function public.sync_web_user_metadata()
returns trigger as $$
begin
  update auth.users
  set raw_user_meta_data = 
    coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
        'user_type', 'web',
        'role', new.role
      )
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- 2️⃣ Trigger after insert/update on web_users
drop trigger if exists trg_sync_web_user_metadata on public.web_users;
create trigger trg_sync_web_user_metadata
after insert or update of role
on public.web_users
for each row
execute function public.sync_web_user_metadata();

-- 3️⃣ Optional: function to clear metadata if user is deleted
create or replace function public.clear_web_user_metadata()
returns trigger as $$
begin
  update auth.users
  set raw_user_meta_data = (raw_user_meta_data - 'user_type' - 'role')
  where id = old.id;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_clear_web_user_metadata on public.web_users;
create trigger trg_clear_web_user_metadata
after delete
on public.web_users
for each row
execute function public.clear_web_user_metadata();
