-- 20260909_user_profiles_birth_year.sql
--
-- Root cause: ALPHA-01A (beb2ea2) added birth_year to the user_profiles upsert
-- and full-profile SELECT, but the column was never added to the table.
-- Supabase returned "column user_profiles.birth_year does not exist" on every
-- wizard-step 1 call. The error was silently swallowed; server returned {ok:true}.
-- full-profile SELECT also failed → profile:{} → onboarding guard never passed
-- → wizard restarted on every page reload for new users.
--
-- Safe: ADD COLUMN IF NOT EXISTS, nullable integer, no data migration needed.
-- Idempotent: safe to re-run.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS birth_year integer;
