create table if not exists public.vh_scenes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  character_id text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists vh_scenes_character_idx on public.vh_scenes (character_id, created_at desc);
alter table public.vh_scenes enable row level security;
