-- Migration: Add email field to web_users table
-- This migration decouples web_users from relying on auth.users for email data

-- Step 1: Add email column to web_users table (nullable initially)
ALTER TABLE public.web_users
ADD COLUMN email text;

-- Step 2: Populate email data from auth.users table for existing records
UPDATE public.web_users
SET email = auth.users.email
FROM auth.users
WHERE web_users.id = auth.users.id
AND auth.users.email IS NOT NULL;

-- Step 3: Make email NOT NULL since all web users should have emails
ALTER TABLE public.web_users
ALTER COLUMN email SET NOT NULL;

-- Step 4: Add unique constraint to ensure email uniqueness
ALTER TABLE public.web_users
ADD CONSTRAINT web_users_email_unique UNIQUE (email);

-- Step 5: Add check constraint to ensure valid email format (basic validation)
ALTER TABLE public.web_users
ADD CONSTRAINT web_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Step 6: Update the schema.sql file to reflect these changes
-- (This would need to be done manually or through a separate process)

-- Note: If you encounter issues with the NOT NULL constraint due to existing NULL values,
-- you may need to handle those cases first before applying this migration.
