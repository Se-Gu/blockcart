-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  rule_json jsonb,
  multiplier numeric DEFAULT 1,
  start_date date,
  end_date date,
  updated_at timestamp with time zone DEFAULT now(),
  version integer DEFAULT 1,
  name text,
  description text,
  reward_amount numeric DEFAULT 0,
  max_participants integer,
  current_participants integer DEFAULT 0,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'completed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.maintenance_state (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  maintenance_mode boolean DEFAULT false,
  last_maintenance_at timestamp with time zone DEFAULT now(),
  last_aggregator_sync timestamp with time zone DEFAULT now(),
  supabase_status text DEFAULT 'operational'::text CHECK (supabase_status = ANY (ARRAY['operational'::text, 'degraded'::text, 'down'::text])),
  analytics_status text DEFAULT 'offline'::text CHECK (analytics_status = ANY (ARRAY['operational'::text, 'degraded'::text, 'offline'::text])),
  app_version text DEFAULT '0.1.0'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT maintenance_state_pkey PRIMARY KEY (id)
);
CREATE TABLE public.maintenance_tasks (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  last_run_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'idle'::text CHECK (status = ANY (ARRAY['idle'::text, 'running'::text, 'error'::text])),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT maintenance_tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.receipt_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  status text DEFAULT 'assigned'::text CHECK (status = ANY (ARRAY['assigned'::text, 'completed'::text, 'returned'::text])),
  assigned_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  released_at timestamp with time zone,
  CONSTRAINT receipt_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT receipt_assignments_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id),
  CONSTRAINT receipt_assignments_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.web_users(id)
);
CREATE TABLE public.receipt_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['approve'::text, 'reject'::text, 'flag'::text, 'edit'::text])),
  previous_fields jsonb,
  new_fields jsonb,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT receipt_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT receipt_reviews_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id),
  CONSTRAINT receipt_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.web_users(id)
);
CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  image_url text NOT NULL,
  store text,
  total numeric,
  receipt_date date,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'flagged'::text, 'error'::text])),
  parsed_json jsonb,
  created_at timestamp with time zone DEFAULT now(),
  reward_amount numeric DEFAULT 0,
  ocr_text text,
  ocr_json jsonb,
  extracted_fields jsonb,
  reviewed_fields jsonb,
  moderation_result jsonb,
  reviewed_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  rejection_reason text,
  image_hash text,
  location text,
  payment_method text,
  receipt_time time without time zone,
  CONSTRAINT receipts_pkey PRIMARY KEY (id),
  CONSTRAINT receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT receipts_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.web_users(id)
);
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  referrer uuid,
  referee uuid,
  bonus numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text])),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_fkey FOREIGN KEY (referrer) REFERENCES public.users(id),
  CONSTRAINT referrals_referee_fkey FOREIGN KEY (referee) REFERENCES public.users(id)
);
CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  receipt_id uuid,
  amount numeric NOT NULL,
  campaign_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text])),
  paid_at timestamp with time zone,
  CONSTRAINT rewards_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT rewards_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id),
  CONSTRAINT rewards_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  wallet_address text,
  kyc_age integer,
  kyc_sex text,
  referral_code text UNIQUE,
  referred_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.web_users (
  id uuid NOT NULL,
  role text DEFAULT 'reviewer'::text CHECK (role = ANY (ARRAY['admin'::text, 'reviewer'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  email text NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  CONSTRAINT web_users_pkey PRIMARY KEY (id),
  CONSTRAINT web_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);