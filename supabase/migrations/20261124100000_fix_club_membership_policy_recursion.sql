-- Avoid recursive RLS evaluation when checking whether a member already
-- has a pending or active club membership.
create or replace function private.user_has_open_club_membership(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.club_memberships cm
    where cm.user_id = p_user_id
      and cm.status in ('pending'::public.membership_status, 'active'::public.membership_status)
  );
$function$;

revoke all on function private.user_has_open_club_membership(uuid) from public, anon;
grant execute on function private.user_has_open_club_membership(uuid) to authenticated;

drop policy if exists "Members can request approved club membership" on public.club_memberships;

create policy "Members can request approved club membership"
on public.club_memberships
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'::public.membership_status
  and exists (
    select 1
    from public.clubs c
    where c.id = club_memberships.club_id
      and c.status = 'approved'::public.org_status
  )
  and not private.user_has_open_club_membership((select auth.uid()))
);
