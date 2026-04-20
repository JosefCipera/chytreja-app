-- agent_log: caches daily action decisions from specialized agents
create table if not exists agent_log (
  id           uuid default gen_random_uuid() primary key,
  user_id      text not null,
  node_id      text not null,
  discipline   text not null,
  date         date not null,
  tier         int,
  action_id    text,
  label        text,
  type         text,        -- timed | counter | distance
  duration_s   int,
  sets         int,
  reps         int,
  distance_m   int,
  coaching_note text,
  created_at   timestamptz default now()
);

-- one action per user/node/discipline/day
create unique index if not exists agent_log_unique
  on agent_log (user_id, node_id, discipline, date);

-- RLS
alter table agent_log enable row level security;

create policy "users read own agent_log"
  on agent_log for select
  using (auth.uid()::text = user_id);
