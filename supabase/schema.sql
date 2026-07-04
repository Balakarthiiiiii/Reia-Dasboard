-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query)

create table if not exists sales (
  id text primary key,
  date date,
  store text,
  category text,
  purity text,
  gold_color text,
  gold_wt numeric,
  dia_wt numeric,
  mc_rate numeric,
  sale_price numeric,
  created_at timestamptz default now()
);

create table if not exists overheads (
  id text primary key,
  month text,
  store text,
  rent numeric,
  electricity numeric,
  maintenance numeric,
  salaries numeric,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id text primary key,
  date date,
  store text,
  category text,
  amount numeric,
  note text,
  created_at timestamptz default now()
);

-- Enable Realtime so all connected clients receive live updates the instant
-- any row is added, edited, or deleted (no page refresh needed). Run this
-- once, after the tables above exist.
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table overheads;
alter publication supabase_realtime add table expenses;

-- Row Level Security is OFF by default for new tables in most Supabase projects,
-- which is fine to start with since only you hold the anon key. If you want to
-- lock this down later (e.g. before sharing access with staff), enable RLS and
-- add policies, for example:
--
-- alter table sales enable row level security;
-- create policy "Allow all for authenticated users" on sales
--   for all using (auth.role() = 'authenticated');