create extension if not exists "pgcrypto";

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  location text not null,
  result_count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_searches enable row level security;

create policy "Users can read their own searches"
on public.saved_searches for select using (auth.uid() = user_id);

create policy "Users can create their own searches"
on public.saved_searches for insert with check (auth.uid() = user_id);

create policy "Users can delete their own searches"
on public.saved_searches for delete using (auth.uid() = user_id);

create index if not exists saved_searches_user_created_idx
on public.saved_searches (user_id, created_at desc);
