-- Migration: add onboarding_completed flag to user_profiles
-- Run manually in Supabase SQL Editor.
--
-- NULL  = completion not confirmed (new users, pre-flag users, interrupted wizard)
-- TRUE  = wizard was completed and confirmed via ?action=wizard-complete
--
-- No retroactive backfill — NULL means "unknown", not "not done".
-- wizard-complete is the only writer; pre-intake and session-handoff never touch this column.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT NULL;
