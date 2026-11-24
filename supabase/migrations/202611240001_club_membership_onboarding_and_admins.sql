-- Club membership onboarding and scoped club administration.
create table public.club_admins (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index club_admins_user_club_idx on public.club_admins(user_id, club_id);
alter table public.club_admins enable row level security;

create or replace function private.is_platform_admin(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_user_id and p.platform_role = 'platform_admin');
$$;

create or replace function private.is_club_admin(p_club_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_platform_admin(p_user_id)
    or exists (select 1 from public.club_admins ca where ca.club_id = p_club_id and ca.user_id = p_user_id);
$$;

revoke all on function private.is_platform_admin(uuid) from public, anon;
revoke all on function private.is_club_admin(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin(uuid) to authenticated;
grant execute on function private.is_club_admin(uuid, uuid) to authenticated;

create policy "Club admins can view their admin assignments"
on public.club_admins for select to authenticated
using (user_id = (select auth.uid()) or private.is_platform_admin((select auth.uid())));

create policy "Club admins can view club membership requests"
on public.club_memberships for select to authenticated
using (user_id = (select auth.uid()) or private.is_club_admin(club_id, (select auth.uid())));

create policy "Members can request approved club membership"
on public.club_memberships for insert to authenticated
with check (
  user_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from public.clubs c where c.id = club_id and c.status = 'approved')
  and not exists (
    select 1 from public.club_memberships existing
    where existing.user_id = (select auth.uid()) and existing.status in ('pending', 'active')
  )
);

create or replace function private.review_club_membership(p_membership_id uuid, p_approve boolean)
returns public.membership_status language plpgsql security definer set search_path = ''
as $$
declare v_membership public.club_memberships%rowtype; v_status public.membership_status;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_membership from public.club_memberships where id = p_membership_id for update;
  if not found then raise exception 'Membership request not found'; end if;
  if not private.is_club_admin(v_membership.club_id, auth.uid()) then
    raise exception 'You are not authorised to review requests for this club';
  end if;
  if v_membership.status <> 'pending' then raise exception 'Only pending requests can be reviewed'; end if;
  if p_approve and exists (
    select 1 from public.club_memberships other
    where other.user_id = v_membership.user_id and other.status = 'active' and other.id <> v_membership.id
  ) then raise exception 'This member already has an active club membership'; end if;
  v_status := case when p_approve then 'active'::public.membership_status else 'rejected'::public.membership_status end;
  update public.club_memberships set status = v_status,
    joined_at = case when p_approve then now() else null end, ended_at = null
  where id = p_membership_id;
  insert into public.membership_history(user_id, old_club_id, new_club_id, action, initiated_by, approved_by, notes)
  values (v_membership.user_id, null, v_membership.club_id,
    case when p_approve then 'joined' else 'membership_rejected' end,
    v_membership.user_id, auth.uid(),
    case when p_approve then 'Membership request approved' else 'Membership request rejected' end);
  return v_status;
end;
$$;
revoke all on function private.review_club_membership(uuid, boolean) from public, anon;
grant execute on function private.review_club_membership(uuid, boolean) to authenticated;

create or replace function public.review_club_membership(p_membership_id uuid, p_approve boolean)
returns public.membership_status language sql security invoker set search_path = ''
as $$ select private.review_club_membership(p_membership_id, p_approve); $$;
revoke all on function public.review_club_membership(uuid, boolean) from public, anon;
grant execute on function public.review_club_membership(uuid, boolean) to authenticated;

create or replace function private.grant_club_admin(p_club_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not private.is_platform_admin(auth.uid()) then
    raise exception 'Only a platform administrator can appoint club administrators';
  end if;
  if not exists (select 1 from public.clubs c where c.id = p_club_id) then raise exception 'Club not found'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then raise exception 'User profile not found'; end if;
  insert into public.club_admins(club_id, user_id, granted_by)
  values (p_club_id, p_user_id, auth.uid())
  on conflict (club_id, user_id) do update set granted_by = excluded.granted_by
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.grant_club_admin(uuid, uuid) from public, anon;
grant execute on function private.grant_club_admin(uuid, uuid) to authenticated;

create or replace function public.appoint_club_admin(p_club_id uuid, p_user_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.grant_club_admin(p_club_id, p_user_id); $$;
revoke all on function public.appoint_club_admin(uuid, uuid) from public, anon;
grant execute on function public.appoint_club_admin(uuid, uuid) to authenticated;
