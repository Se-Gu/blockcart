-- Migration: Fix schema discrepancies between database and frontend expectations
-- This migration adds missing fields to campaigns and referrals tables

-- Step 1: Add missing fields to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN version integer DEFAULT 1,
ADD COLUMN name text,
ADD COLUMN description text,
ADD COLUMN reward_amount numeric DEFAULT 0,
ADD COLUMN max_participants integer,
ADD COLUMN current_participants integer DEFAULT 0,
ADD COLUMN status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'completed'::text])),
ADD COLUMN created_at timestamp with time zone DEFAULT now();

-- Step 2: Update existing campaigns to have proper created_at timestamps
UPDATE public.campaigns
SET created_at = updated_at
WHERE created_at IS NULL;

-- Step 3: Add missing status field to referrals table (with default)
-- Note: Since we added a default value, existing rows will automatically get 'pending' status
ALTER TABLE public.referrals
ADD COLUMN status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text]));

-- Step 4: Update the schema.sql file to reflect these changes
-- (This would need to be done manually or through a separate process)

-- Note: After running this migration, you may need to:
-- 1. Update existing campaign records to populate the new fields with appropriate values
-- 2. Update any queries that reference these tables to handle the new fields
-- 3. Update the TypeScript interfaces if needed (though they should already match)
