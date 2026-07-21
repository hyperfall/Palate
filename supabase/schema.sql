-- Palate — saved-recipe collections. Run once in the Supabase SQL editor.
-- Content stays in Payload/Postgres; Supabase owns identity + user data.
-- Items snapshot slug/title/image so no cross-database join is ever needed.

create extension if not exists pgcrypto;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_slug text not null,
  recipe_title text not null,
  recipe_image text,
  created_at timestamptz not null default now(),
  unique (collection_id, recipe_slug)
);

create index if not exists collection_items_user_idx on public.collection_items (user_id, created_at desc);
create index if not exists collection_items_collection_idx on public.collection_items (collection_id);

-- Row-level security: every row is private to its owner.
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists "own collections" on public.collections;
create policy "own collections" on public.collections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Own items, AND only in a collection you own. The extra EXISTS closes a gap:
-- without it, a caller could insert an item (stamped with their own user_id)
-- into someone else's collection id and, via the (collection_id, recipe_slug)
-- unique constraint, block that owner from saving the same recipe.
drop policy if exists "own items" on public.collection_items;
create policy "own items" on public.collection_items
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

-- Username reservations — the authoritative unique namespace for public @handles.
-- One row per user; the UNIQUE constraint on `username` is what actually enforces
-- "no two people hold the same handle" — atomically, even under a race. The live
-- typeahead check is only UX; this constraint is the real guarantee.
create table if not exists public.usernames (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null unique
    check (username = lower(username) and char_length(username) between 2 and 30),
  updated_at timestamptz not null default now()
);

alter table public.usernames enable row level security;

-- Owners manage only their own reservation row.
drop policy if exists "own username" on public.usernames;
create policy "own username" on public.usernames
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Availability check, leak-free: returns only a boolean, never rows. SECURITY
-- DEFINER lets it see across all reservations despite RLS; the caller's own
-- reservation is excluded so editing never reports "taken" against themselves.
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.usernames
    where username = lower(candidate)
      and user_id is distinct from auth.uid()
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
