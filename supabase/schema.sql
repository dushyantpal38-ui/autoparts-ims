-- ============================================================================
-- AutoParts IMS — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

-- ---------------------------------------------------------------- parts -----
create table if not exists public.parts (
  id                   text primary key,            -- INV-10001 (allocated client-side via next_part_id)
  qr_code              text not null,
  part_number          text not null,
  part_name            text not null,
  category             text not null default '',
  vehicle_model        text not null default '',
  description          text not null default '',
  quantity             integer not null default 0 check (quantity >= 0),
  minimum_stock        integer not null default 0 check (minimum_stock >= 0),
  warehouse            text not null default '',
  rack                 text not null default '',
  shelf                text not null default '',
  bin                  text not null default '',
  supplier             text not null default '',
  supplier_part_number text not null default '',
  unit_cost            numeric(12,2) not null default 0,
  date_added           timestamptz not null default now(),
  last_updated         timestamptz not null default now(),
  notes                text not null default ''
);

create unique index if not exists parts_part_number_lower_idx on public.parts (lower(part_number));
create index if not exists parts_warehouse_idx on public.parts (warehouse);

-- ------------------------------------------------------------- activity -----
create table if not exists public.activity (
  id            uuid primary key default gen_random_uuid(),
  part_id       text,
  part_number   text not null default '',
  part_name     text not null default '',
  action        text not null,
  delta         integer,
  prev_qty      integer,
  new_qty       integer,
  prev_location text,
  new_location  text,
  summary       text,
  user_name     text not null default '',
  user_email    text not null default '',
  role          text not null default 'staff',
  reason        text not null default '',
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists activity_created_idx on public.activity (created_at desc);
create index if not exists activity_part_idx on public.activity (part_id);

-- ------------------------------------------------------------- profiles -----
-- One row per user; the FIRST user to sign up becomes admin.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null default '',
  name       text not null default '',
  role       text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Auto-create a profile on signup; first ever user is admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'staff' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------- id allocator (atomic) ----
create sequence if not exists public.part_id_seq start 10039;

create or replace function public.next_part_id()
returns text language sql security definer set search_path = public as $$
  select 'INV-' || nextval('public.part_id_seq');
$$;

-- -------------------------------------------------------------------- RLS ---
alter table public.parts enable row level security;
alter table public.activity enable row level security;

-- Parts: everyone signed in can read, add and update (stock counts, moves).
-- Deletes are restricted to admins via the helper below.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "parts select authenticated" on public.parts
  for select to authenticated using (true);
create policy "parts insert authenticated" on public.parts
  for insert to authenticated with check (true);
create policy "parts update authenticated" on public.parts
  for update to authenticated using (true);
create policy "parts delete admin" on public.parts
  for delete to authenticated using (public.is_admin());

-- Activity is append-only for users; readable by everyone signed in.
create policy "activity select authenticated" on public.activity
  for select to authenticated using (true);
create policy "activity insert authenticated" on public.activity
  for insert to authenticated with check (true);

-- Profiles also need RLS for the helper functions' table access (done above).

-- --------------------------------------------------------------- realtime ---
alter publication supabase_realtime add table public.parts;
alter publication supabase_realtime add table public.activity;

-- ============================================================================
-- Useful admin SQL:
--   Promote someone to admin:
--     update public.profiles set role = 'admin' where email = 'you@example.com';
--   Wipe everything (start clean):
--     delete from public.activity; delete from public.parts;
-- ============================================================================
