-- Migration: Create review_notifications table for user notifications about receipt reviews
-- This is separate from reviewer_notifications which are for reviewers

create table if not exists public.review_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  status text not null default 'unread' check (status in ('unread', 'read')),
  title text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Create an index on user_id and status for efficient querying
create index if not exists review_notifications_user_status_idx
  on public.review_notifications (user_id, status, created_at desc)
  where status = 'unread';

-- Create an index on user_id for general queries
create index if not exists review_notifications_user_idx
  on public.review_notifications (user_id, created_at desc);

-- Add a comment to explain the table structure
comment on table public.review_notifications is 'Stores notifications sent to users about their receipt review outcomes (approved/rejected).';

