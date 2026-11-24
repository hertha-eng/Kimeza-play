-- Secure club invitation code issuance and redemption.
create unique index if not exists one_pending_membership_per_user
  on public.club_memberships(user_id) where status = 'pending';

create or replace function private.create_club_invitation_code(p_club_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_code text;
begin
  if auth.uid() is null or not private.is_club_admin(p_club_id, auth.uid()) then
    raise exception 'Only an administrator of this club can create invitation codes';
  end if;
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.status = 'approved') then
    raise exception 'Only approved clubs can issue invitation codes';
  end if;
  v_code := upper(encode(gen_random_bytes(8), 'hex'));
  insert into public.club_invitation_codes(club_id, code_hash, created_by)
  values (p_club_id, encode(digest(v_code, 'sha256'), 'hex'), auth.uid());
  return v_code;
end;
$$;
revoke all on function private.create_club_invitation_code(uuid) from public, anon;
grant execute on function private.create_club_invitation_code(uuid) to authenticated;

create or replace function public.create_club_invitation_code(p_club_id uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.create_club_invitation_code(p_club_id); $$;
revoke all on function public.create_club_invitation_code(uuid) from public, anon;
grant execute on function public.create_club_invitation_code(uuid) to authenticated;

create or replace function private.redeem_club_invitation_code(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid; v_club_id uuid; v_membership_id uuid; v_normalized text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Sign in before redeeming an invitation'; end if;
  v_normalized := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
  if length(v_normalized) < 8 or length(v_normalized) > 64 then raise exception 'Enter a valid invitation code'; end if;
  select cic.club_id into v_club_id
  from public.club_invitation_codes cic
  join public.clubs c on c.id = cic.club_id
  where cic.code_hash = encode(digest(v_normalized, 'sha256'), 'hex')
    and cic.is_active = true and c.status = 'approved' limit 1;
  if v_club_id is null then raise exception 'Invitation code is invalid or inactive'; end if;
  if exists (select 1 from public.club_memberships m where m.user_id = v_user_id and m.status in ('pending','active')) then
    raise exception 'You already have a pending request or active club membership';
  end if;
  insert into public.club_memberships(club_id, user_id, status, joined_at)
  values (v_club_id, v_user_id, 'active', now()) returning id into v_membership_id;
  insert into public.membership_history(user_id, old_club_id, new_club_id, action, initiated_by, approved_by, notes)
  values (v_user_id, null, v_club_id, 'joined', v_user_id, null, 'Joined using a club invitation code');
  return v_membership_id;
end;
$$;
revoke all on function private.redeem_club_invitation_code(text) from public, anon;
grant execute on function private.redeem_club_invitation_code(text) to authenticated;

create or replace function public.redeem_club_invitation_code(p_code text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.redeem_club_invitation_code(p_code); $$;
revoke all on function public.redeem_club_invitation_code(text) from public, anon;
grant execute on function public.redeem_club_invitation_code(text) to authenticated;

-- Restrict direct table operations to the minimum required by the client.
revoke all on table public.club_admins from anon, authenticated;
grant select on table public.club_admins to authenticated;
revoke insert, update, delete on table public.club_memberships from anon, authenticated;
grant select, insert on table public.club_memberships to authenticated;
revoke insert, update, delete on table public.clubs from anon, authenticated;
grant select on table public.clubs to authenticated;
