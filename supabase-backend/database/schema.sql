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
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);
--
-- Campaign management helper functions
--
CREATE OR REPLACE FUNCTION public.create_campaign(campaign_data jsonb)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _brand text := trim(coalesce(campaign_data ->> 'brand', ''));
  _multiplier_text text := NULLIF(trim(coalesce(campaign_data ->> 'multiplier', '')), '');
  _multiplier numeric := 1;
  _rule jsonb := campaign_data -> 'rule_json';
  _start_text text := NULLIF(trim(coalesce(campaign_data ->> 'start_date', '')), '');
  _end_text text := NULLIF(trim(coalesce(campaign_data ->> 'end_date', '')), '');
  _start_date date;
  _end_date date;
  _new_campaign public.campaigns;
BEGIN
  IF _brand = '' THEN
    RAISE EXCEPTION 'Brand is required';
  END IF;

  IF _multiplier_text IS NOT NULL THEN
    BEGIN
      _multiplier := _multiplier_text::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Multiplier must be numeric';
    END;
  END IF;

  IF _multiplier <= 0 THEN
    RAISE EXCEPTION 'Multiplier must be greater than zero';
  END IF;

  IF _rule = 'null'::jsonb THEN
    _rule := NULL;
  END IF;

  IF _rule IS NOT NULL AND jsonb_typeof(_rule) <> 'object' THEN
    RAISE EXCEPTION 'rule_json must be a JSON object';
  END IF;

  IF _start_text IS NOT NULL THEN
    BEGIN
      _start_date := _start_text::date;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid start_date value';
    END;
  END IF;

  IF _end_text IS NOT NULL THEN
    BEGIN
      _end_date := _end_text::date;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid end_date value';
    END;
  END IF;

  IF _start_date IS NOT NULL AND _end_date IS NOT NULL AND _start_date > _end_date THEN
    RAISE EXCEPTION 'start_date must be on or before end_date';
  END IF;

  INSERT INTO public.campaigns (brand, multiplier, rule_json, start_date, end_date, updated_at)
  VALUES (_brand, _multiplier, _rule, _start_date, _end_date, now())
  RETURNING * INTO _new_campaign;

  RETURN _new_campaign;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_campaign(campaign_id uuid, campaign_data jsonb)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.campaigns;
  _brand text := trim(coalesce(campaign_data ->> 'brand', ''));
  _multiplier_text text := NULLIF(trim(coalesce(campaign_data ->> 'multiplier', '')), '');
  _multiplier numeric := 1;
  _rule jsonb := campaign_data -> 'rule_json';
  _start_text text := NULLIF(trim(coalesce(campaign_data ->> 'start_date', '')), '');
  _end_text text := NULLIF(trim(coalesce(campaign_data ->> 'end_date', '')), '');
  _start_date date;
  _end_date date;
BEGIN
  SELECT * INTO _existing FROM public.campaigns WHERE id = campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', campaign_id USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  IF _brand = '' THEN
    RAISE EXCEPTION 'Brand is required';
  END IF;

  IF _multiplier_text IS NOT NULL THEN
    BEGIN
      _multiplier := _multiplier_text::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Multiplier must be numeric';
    END;
  ELSE
    _multiplier := COALESCE(_existing.multiplier, 1);
  END IF;

  IF _multiplier <= 0 THEN
    RAISE EXCEPTION 'Multiplier must be greater than zero';
  END IF;

  IF _rule = 'null'::jsonb THEN
    _rule := NULL;
  END IF;

  IF _rule IS NOT NULL AND jsonb_typeof(_rule) <> 'object' THEN
    RAISE EXCEPTION 'rule_json must be a JSON object';
  END IF;

  IF _start_text IS NOT NULL THEN
    BEGIN
      _start_date := _start_text::date;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid start_date value';
    END;
  ELSE
    _start_date := _existing.start_date;
  END IF;

  IF _end_text IS NOT NULL THEN
    BEGIN
      _end_date := _end_text::date;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid end_date value';
    END;
  ELSE
    _end_date := _existing.end_date;
  END IF;

  IF _start_date IS NOT NULL AND _end_date IS NOT NULL AND _start_date > _end_date THEN
    RAISE EXCEPTION 'start_date must be on or before end_date';
  END IF;

  UPDATE public.campaigns
  SET
    brand = _brand,
    multiplier = _multiplier,
    rule_json = _rule,
    start_date = _start_date,
    end_date = _end_date,
    updated_at = now()
  WHERE id = campaign_id
  RETURNING * INTO _existing;

  RETURN _existing;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_campaign(campaign_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted uuid;
BEGIN
  DELETE FROM public.campaigns WHERE id = campaign_id RETURNING id INTO _deleted;

  IF _deleted IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found', campaign_id USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  RETURN _deleted;
END;
$$;
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
  CONSTRAINT receipt_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id)
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
  CONSTRAINT rewards_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT rewards_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
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
  CONSTRAINT web_users_pkey PRIMARY KEY (id),
  CONSTRAINT web_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);