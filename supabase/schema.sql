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

-- ── Phase 3: planning layer (meal plan, pantry, taste profile) ──────────────
-- Run this block once in the Supabase SQL editor (idempotent).

-- The cook's pantry: on-hand ingredients (snapshot slug+name so no cross-DB join).
-- is_staple marks always-haves the shopping list should never re-list.
create table if not exists public.pantry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ingredient_slug text not null,
  ingredient_name text not null,
  is_staple boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, ingredient_slug)
);
create index if not exists pantry_user_idx on public.pantry (user_id);

-- One saved taste profile per user (the 0–5 axes), from the /taste onboarding.
create table if not exists public.taste_profile (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  spiciness int not null check (spiciness between 0 and 5),
  sweetness int not null check (sweetness between 0 and 5),
  richness int not null check (richness between 0 and 5),
  effort int not null check (effort between 0 and 5),
  updated_at timestamptz not null default now()
);

-- The weekly board: recipes assigned to weekdays (0=Mon … 6=Sun). Snapshots
-- slug/title/image like collections do, so no cross-database join is needed.
create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  recipe_slug text not null,
  recipe_title text not null,
  recipe_image text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meal_plan_user_idx on public.meal_plan (user_id, day, position);
-- Meal slot within a day (breakfast/lunch/dinner). Existing rows become dinner.
alter table public.meal_plan add column if not exists meal text not null default 'dinner';

alter table public.pantry enable row level security;
alter table public.taste_profile enable row level security;
alter table public.meal_plan enable row level security;

drop policy if exists "own pantry" on public.pantry;
create policy "own pantry" on public.pantry
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own taste" on public.taste_profile;
create policy "own taste" on public.taste_profile
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own plan" on public.meal_plan;
create policy "own plan" on public.meal_plan
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Phase 4: growth (shared plans, follows) ─────────────────────────────────
-- Public share links for a week's plan/shopping list. The unguessable id IS the
-- token; anyone with the link may read, only the owner may create/delete.
create table if not exists public.plan_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_slugs text[] not null default '{}',
  -- Structured week snapshot {title, weekOf, days:[{day, dishes/meals…}]} so a
  -- shared card renders faithfully (day + meal) and stays immutable. `recipe_slugs`
  -- is kept for back-compat with older shares.
  week jsonb,
  created_at timestamptz not null default now()
);
-- Back-fill the week snapshot column onto tables created before it existed
-- (`create table if not exists` above is a no-op once the table is present).
alter table public.plan_shares add column if not exists week jsonb;
alter table public.plan_shares enable row level security;
drop policy if exists "create own share" on public.plan_shares;
create policy "create own share" on public.plan_shares for insert with check (user_id = auth.uid());
drop policy if exists "delete own share" on public.plan_shares;
create policy "delete own share" on public.plan_shares for delete using (user_id = auth.uid());
drop policy if exists "read shares by link" on public.plan_shares;
create policy "read shares by link" on public.plan_shares for select using (true);

-- Follows: a viewer follows a creator by their public author slug.
create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_slug text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_slug)
);
create index if not exists follows_follower_idx on public.follows (follower_id);
alter table public.follows enable row level security;
drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- ── Supporter tier (Stripe subscriptions) ───────────────────────────────────
-- One row per user, written ONLY by the Stripe webhook via the service-role
-- key (no client insert/update policies on purpose). The client may read its
-- own row; entitlements are derived server-side in src/lib/entitlements.ts.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (user_id = auth.uid());

-- ── Household mode (shared plan + pantry + list) ─────────────────────────────
-- Creating a household is a supporter perk (enforced server-side in the create
-- route); joining is free. One household per user in v1. households and
-- household_members are written only via the service role (create route) and
-- the join_household RPC — regular users get read + leave.
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our kitchen' check (char_length(trim(name)) between 1 and 60),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id) -- one household per user (v1)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- The caller's household id, resolved WITHOUT touching RLS. This is the seam
-- that breaks recursion: a policy on household_members that queried
-- household_members would recurse ("infinite recursion detected in policy"),
-- which also poisons every meal_plan/pantry policy that references it. A
-- security-definer function bypasses RLS, so policies can call it freely.
create or replace function public.my_household_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;
revoke all on function public.my_household_id() from public;
grant execute on function public.my_household_id() to authenticated;

-- Members read their household; nobody writes households directly (service role
-- / RPC only), so no insert/update/delete policies for regular users.
drop policy if exists "read own household" on public.households;
create policy "read own household" on public.households
  for select using (id = public.my_household_id());

-- Members read their household's membership list; anyone may leave (delete own).
-- Uses the helper (not a self-select) to avoid recursive policy evaluation.
drop policy if exists "read household members" on public.household_members;
create policy "read household members" on public.household_members
  for select using (household_id = public.my_household_id());
drop policy if exists "leave household" on public.household_members;
create policy "leave household" on public.household_members
  for delete using (user_id = auth.uid());

-- Shared scope on plan + pantry: a nullable household_id, back-filled onto the
-- existing tables (idempotent — the plan_shares lesson).
alter table public.meal_plan add column if not exists household_id uuid references public.households (id) on delete set null;
alter table public.pantry add column if not exists household_id uuid references public.households (id) on delete set null;
create index if not exists meal_plan_household_idx on public.meal_plan (household_id);
create index if not exists pantry_household_idx on public.pantry (household_id);

-- Auto-stamp household_id from the writer's membership on every insert/update,
-- so client mutations need no change and can never mis-set the scope. Fires
-- for both because upserts (pantry "have it") land as updates.
create or replace function public.set_row_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.household_id := public.my_household_id();
  return new;
end;
$$;

drop trigger if exists meal_plan_household on public.meal_plan;
create trigger meal_plan_household before insert or update on public.meal_plan
  for each row execute function public.set_row_household();
drop trigger if exists pantry_household on public.pantry;
create trigger pantry_household before insert or update on public.pantry
  for each row execute function public.set_row_household();

-- Access = your own rows OR your household's rows. WITH CHECK keeps user_id
-- honest; the trigger owns household_id. (A member may delete a shared row —
-- intentional for a shared week; only the row owner may update their own.)
drop policy if exists "own plan" on public.meal_plan;
drop policy if exists "plan access" on public.meal_plan;
create policy "plan access" on public.meal_plan
  for all
  using (user_id = auth.uid() or household_id = public.my_household_id())
  with check (user_id = auth.uid());

drop policy if exists "own pantry" on public.pantry;
drop policy if exists "pantry access" on public.pantry;
create policy "pantry access" on public.pantry
  for all
  using (user_id = auth.uid() or household_id = public.my_household_id())
  with check (user_id = auth.uid());

-- Join by invite code: security-definer so it can see households despite RLS.
-- Refuses if the caller already belongs to a household (one per user, v1).
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  select id into hid from public.households where invite_code = code;
  if hid is null then raise exception 'invalid code'; end if;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'member');
  return hid;
end;
$$;
revoke all on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;

-- ── Shopping Mode (household-synced checklist) ──────────────────────────────
-- A row = the item is "in the basket"; check = insert, uncheck = delete by
-- item_key. Reuses the household machinery: set_row_household() stamps
-- household_id, and RLS is own-or-household via my_household_id(). item_key is
-- the shopping list's stable ShoppingLine key (id:<n> / name:<x>).
create table if not exists public.shopping_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now()
);
-- One check per item within a scope (household when shared, else the user).
create unique index if not exists shopping_checks_household_key
  on public.shopping_checks (household_id, item_key) where household_id is not null;
create unique index if not exists shopping_checks_user_key
  on public.shopping_checks (user_id, item_key) where household_id is null;

-- So realtime DELETE events carry item_key (not just the pk) for live uncheck.
alter table public.shopping_checks replica identity full;

drop trigger if exists shopping_checks_household on public.shopping_checks;
create trigger shopping_checks_household before insert or update on public.shopping_checks
  for each row execute function public.set_row_household();

alter table public.shopping_checks enable row level security;
drop policy if exists "check access" on public.shopping_checks;
create policy "check access" on public.shopping_checks
  for all
  using (user_id = auth.uid() or household_id = public.my_household_id())
  with check (user_id = auth.uid());

-- Live sync across household members. Guarded so re-running never errors if the
-- table is already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_checks'
  ) then
    alter publication supabase_realtime add table public.shopping_checks;
  end if;
end $$;
