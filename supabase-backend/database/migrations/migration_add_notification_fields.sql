-- Migration: Add title, message, and status columns to reviewer_notifications table
-- This fixes the missing columns that the frontend expects

-- Add title column for notification heading
alter table public.reviewer_notifications
  add column if not exists title text not null default 'New Receipt Assignment';

-- Add message column for notification body
alter table public.reviewer_notifications
  add column if not exists message text not null default 'You have been assigned a new receipt to review.';

-- Add status column to track read/unread state
alter table public.reviewer_notifications
  add column if not exists status text not null default 'unread'
    check (status in ('unread', 'read'));

-- Create an index on status for efficient filtering
create index if not exists reviewer_notifications_status_idx
  on public.reviewer_notifications (status);

-- Update existing rows to set status based on read_at
update public.reviewer_notifications
  set status = case
    when read_at is null then 'unread'
    else 'read'
  end
  where status = 'unread'; -- only update rows that still have the default

-- Create a trigger to automatically update status when read_at is set
create or replace function public.update_notification_status()
returns trigger as $$
begin
  if new.read_at is not null and old.read_at is null then
    new.status := 'read';
  elsif new.read_at is null and old.read_at is not null then
    new.status := 'unread';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger reviewer_notifications_status_update
  before update on public.reviewer_notifications
  for each row
  execute function public.update_notification_status();

-- Add a comment to explain the table structure
comment on table public.reviewer_notifications is 'Stores notifications sent to reviewers when they are assigned receipts to review. The status column is automatically synchronized with read_at.';

