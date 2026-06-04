-- Run this in Supabase SQL Editor (one time setup)

create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security: users only see their own contacts
alter table contacts enable row level security;

create policy "Users see own contacts" on contacts
  for select using (auth.uid() = user_id);

create policy "Users insert own contacts" on contacts
  for insert with check (auth.uid() = user_id);

create policy "Users update own contacts" on contacts
  for update using (auth.uid() = user_id);

create policy "Users delete own contacts" on contacts
  for delete using (auth.uid() = user_id);

-- Index for fast queries
create index if not exists contacts_user_id_idx on contacts(user_id);
