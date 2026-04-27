-- Add guide_search and guide_label to agent_log
-- guide_search: short YouTube search query for the action (null if no guide needed)
-- guide_label:  button label shown in UI ("Jak cvičit", "Recept", ...)
-- Run once in Supabase SQL editor.

alter table agent_log
  add column if not exists guide_search text,
  add column if not exists guide_label  text;
