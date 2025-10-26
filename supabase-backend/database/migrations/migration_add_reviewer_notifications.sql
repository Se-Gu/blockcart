-- Migration: Create reviewer_notifications table for reviewer assignment alerts

create table if not exists public.reviewer_notifications (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.web_users(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  assignment_id uuid not null references public.receipt_assignments(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint reviewer_notifications_assignment_unique unique (assignment_id)
);

create index if not exists reviewer_notifications_reviewer_unread_idx
  on public.reviewer_notifications (reviewer_id, created_at desc)
  where read_at is null;
