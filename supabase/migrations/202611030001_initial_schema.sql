-- Kimeza Play initial relational foundation
-- Sensitive writes are reserved for trusted server-side workflows.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.platform_role as enum ('member', 'platform_admin');
create type public.club_type as enum ('rotary', 'rotaract');
create type public.org_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.membership_status as enum ('pending', 'active', 'transferred', 'dismissed', 'rejected');
create type public.match_status as enum ('draft', 'open', 'in_progress', 'completed', 'cancelled');
create type public.representation_scope as enum ('none', 'individual', 'buddy_group', 'club', 'zone', 'district');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  platform_role public.platform_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country_code text,
  status public.org_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id),
  name text not null,
  status public.org_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (district_id, name)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id),
  name text not null,
  club_type public.club_type not null,
  status public.org_status not null default 'pending',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (zone_id, name)
);

-- Invitation hashes are isolated from the club directory and are not readable
-- by ordinary authenticated clients. Trusted functions will validate them.
create table public.club_invitation_codes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  code_hash text not null unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  user_id uuid not null references public.profiles(id),
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or joined_at is null or ended_at >= joined_at)
);
create unique index one_active_membership_per_user
  on public.club_memberships(user_id) where status = 'active';

create table public.membership_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  old_club_id uuid references public.clubs(id),
  new_club_id uuid references public.clubs(id),
  action text not null check (action in ('joined', 'transfer_requested', 'transferred', 'dismissed', 'membership_rejected')),
  initiated_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  notes text,
  occurred_at timestamptz not null default now()
);

create table public.buddy_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.buddy_group_members (
  id uuid primary key default gen_random_uuid(),
  buddy_group_id uuid not null references public.buddy_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  status text not null default 'invited' check (status in ('invited', 'active', 'declined', 'left')),
  joined_at timestamptz,
  unique (buddy_group_id, user_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game_code text not null,
  status public.match_status not null default 'open',
  is_official boolean not null default false,
  created_by uuid not null references public.profiles(id),
  starts_at timestamptz,
  ended_at timestamptz,
  rule_version text not null default '1',
  created_at timestamptz not null default now()
);

create table public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  buddy_group_id uuid references public.buddy_groups(id),
  representation public.representation_scope not null default 'none',
  represented_entity_id uuid,
  representation_locked_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table public.score_ledger (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id),
  participant_id uuid references public.match_participants(id),
  player_id uuid not null references public.profiles(id),
  points integer not null,
  score_type text not null check (score_type in ('game', 'official_competition')),
  destination_scope public.representation_scope not null default 'none',
  destination_entity_id uuid,
  rule_version text not null,
  reverses_entry_id uuid references public.score_ledger(id),
  idempotency_key text not null unique,
  recorded_at timestamptz not null default now(),
  check (
    (destination_scope = 'none' and destination_entity_id is null)
    or (destination_scope <> 'none' and destination_entity_id is not null)
  )
);

create index memberships_user_status_idx on public.club_memberships(user_id, status);
create index memberships_club_status_idx on public.club_memberships(club_id, status);
create index matches_status_created_idx on public.matches(status, created_at desc);
create index score_ledger_player_idx on public.score_ledger(player_id, recorded_at desc);
create index score_ledger_destination_idx on public.score_ledger(destination_scope, destination_entity_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper functions avoid recursive RLS policy evaluation between group tables.
create or replace function private.is_active_buddy_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.buddy_group_members bgm
    where bgm.buddy_group_id = p_group_id
      and bgm.user_id = p_user_id
      and bgm.status = 'active'
  );
$$;

create or replace function private.is_buddy_group_creator(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.buddy_groups bg
    where bg.id = p_group_id and bg.created_by = p_user_id
  );
$$;

revoke all on function private.is_active_buddy_group_member(uuid, uuid) from public;
revoke all on function private.is_buddy_group_creator(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_buddy_group_member(uuid, uuid) to authenticated;
grant execute on function private.is_buddy_group_creator(uuid, uuid) to authenticated;

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.districts enable row level security;
alter table public.zones enable row level security;
alter table public.clubs enable row level security;
alter table public.club_invitation_codes enable row level security;
alter table public.club_memberships enable row level security;
alter table public.membership_history enable row level security;
alter table public.buddy_groups enable row level security;
alter table public.buddy_group_members enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.score_ledger enable row level security;

create policy "Members can view own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Remove broad table-level UPDATE, then allow only ordinary profile columns.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar_url, updated_at) on table public.profiles to authenticated;
create policy "Members can update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members can view approved districts"
  on public.districts for select to authenticated using (status = 'approved');
create policy "Members can view approved zones"
  on public.zones for select to authenticated using (status = 'approved');
create policy "Members can view approved clubs"
  on public.clubs for select to authenticated using (status = 'approved');

create policy "Members can view own memberships"
  on public.club_memberships for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members can view own membership history"
  on public.membership_history for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can view own buddy groups"
  on public.buddy_groups for select to authenticated
  using (
    created_by = (select auth.uid())
    or private.is_active_buddy_group_member(id, (select auth.uid()))
  );

create policy "Members can view own buddy group memberships"
  on public.buddy_group_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_buddy_group_creator(buddy_group_id, (select auth.uid()))
  );

create policy "Members can view open or joined matches"
  on public.matches for select to authenticated
  using (
    status = 'open'
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.match_participants mp
      where mp.match_id = matches.id and mp.user_id = (select auth.uid())
    )
  );

create policy "Members can view own match participation"
  on public.match_participants for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can view own score ledger"
  on public.score_ledger for select to authenticated
  using (player_id = (select auth.uid()));

-- No client write policies are granted for invitations, organisation hierarchy,
-- membership history, match state, participants, or score records. Trusted,
-- audited server-side functions will implement those workflows.
