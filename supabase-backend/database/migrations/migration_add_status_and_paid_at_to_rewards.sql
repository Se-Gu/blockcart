-- Migration: Add status and paid_at columns to rewards table
-- Ensures rewards have explicit lifecycle tracking and paid timestamps

ALTER TABLE public.rewards
  ADD COLUMN status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.rewards
  ADD COLUMN paid_at timestamp with time zone;

ALTER TABLE public.rewards
  ADD CONSTRAINT rewards_status_check CHECK (
    status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text])
  );
