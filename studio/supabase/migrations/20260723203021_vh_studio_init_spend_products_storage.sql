-- Spend log (budget)
create table if not exists public.vh_spend (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  type text not null,
  provider text not null,
  model text not null,
  estimate_usd numeric not null default 0,
  note text
);
alter table public.vh_spend enable row level security;
create index if not exists vh_spend_ts_idx on public.vh_spend (ts desc);

-- Products (apps to promote)
create table if not exists public.vh_products (
  id text primary key,
  name text not null,
  pitch text,
  color text,
  url text,
  created_at timestamptz not null default now()
);
alter table public.vh_products enable row level security;

-- Private storage bucket for product screenshots (server-only access via service role)
insert into storage.buckets (id, name, public)
values ('product-screens', 'product-screens', false)
on conflict (id) do nothing;
