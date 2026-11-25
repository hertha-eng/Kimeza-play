-- Managed fellowship challenge queue with single-recipient offers and expiry.
alter table public.fellowship_challenges
  add column if not exists offered_to_id uuid references auth.users(id) on delete set null;

create index if not exists fellowship_challenges_room_status_position_idx
  on public.fellowship_challenges(room_id, status, queue_position);

create or replace function public.advance_fellowship_challenge_queue(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.fellowship_rooms%rowtype;
  v_ch public.fellowship_challenges%rowtype;
  v_target uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.fellowship_room_members where room_id=p_room_id and user_id=v_uid and left_at is null) then
    raise exception 'Join the room before advancing its queue.';
  end if;
  select * into v_room from public.fellowship_rooms where id=p_room_id for update;
  if not found or v_room.status <> 'social' then return null; end if;

  update public.fellowship_challenges
  set status='expired'::public.fellowship_challenge_status, responded_at=now()
  where room_id=p_room_id and status='offered' and expires_at<=now();

  if exists(select 1 from public.fellowship_challenges where room_id=p_room_id and status='offered') then
    select * into v_ch from public.fellowship_challenges
    where room_id=p_room_id and status='offered' order by offered_at limit 1;
    return v_ch.id;
  end if;
  if exists(select 1 from public.fellowship_challenges where room_id=p_room_id and status='accepted') then return null; end if;

  loop
    select * into v_ch from public.fellowship_challenges
    where room_id=p_room_id and status='queued'
    order by queue_position,created_at limit 1 for update;
    if not found then return null; end if;

    if v_ch.challenged_id is not null then
      v_target:=v_ch.challenged_id;
    else
      select rm.user_id into v_target from public.fellowship_room_members rm
      where rm.room_id=p_room_id and rm.left_at is null and rm.user_id<>v_ch.challenger_id
      order by rm.joined_at,rm.user_id limit 1;
    end if;

    if v_target is null or not exists(select 1 from public.fellowship_room_members where room_id=p_room_id and user_id=v_target and left_at is null) then
      update public.fellowship_challenges set status='expired'::public.fellowship_challenge_status,responded_at=now() where id=v_ch.id;
      continue;
    end if;

    update public.fellowship_challenges
    set status='offered'::public.fellowship_challenge_status,offered_to_id=v_target,
        offered_at=now(),expires_at=now()+interval '25 seconds'
    where id=v_ch.id;
    return v_ch.id;
  end loop;
end;
$$;
revoke all on function public.advance_fellowship_challenge_queue(uuid) from public,anon;
grant execute on function public.advance_fellowship_challenge_queue(uuid) to authenticated;

create or replace function public.queue_fellowship_challenge(p_room_id uuid,p_game_code text,p_challenged_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_pos integer;
begin
  if auth.uid() is null then raise exception 'Sign in to request a match.'; end if;
  if not exists(select 1 from public.fellowship_room_members where room_id=p_room_id and user_id=auth.uid() and left_at is null) then raise exception 'Join the room before requesting a match.'; end if;
  if p_challenged_id=auth.uid() then raise exception 'You cannot challenge yourself.'; end if;
  if p_challenged_id is not null and not exists(select 1 from public.fellowship_room_members where room_id=p_room_id and user_id=p_challenged_id and left_at is null) then raise exception 'That player is not in this room.'; end if;
  if not exists(select 1 from public.fellowship_rooms where id=p_room_id and status='social') then raise exception 'Challenges can only be queued during the social break.'; end if;
  if length(trim(coalesce(p_game_code,'')))=0 or length(trim(p_game_code))>50 then raise exception 'Choose a valid game.'; end if;
  perform 1 from public.fellowship_rooms where id=p_room_id for update;
  select coalesce(max(queue_position),0)+1 into v_pos from public.fellowship_challenges
  where room_id=p_room_id and status in ('queued','offered','accepted');
  insert into public.fellowship_challenges(room_id,challenger_id,challenged_id,game_code,queue_position)
  values(p_room_id,auth.uid(),p_challenged_id,lower(trim(p_game_code)),v_pos) returning id into v_id;
  perform public.advance_fellowship_challenge_queue(p_room_id);
  return v_id;
end;
$$;
revoke all on function public.queue_fellowship_challenge(uuid,text,uuid) from public,anon;
grant execute on function public.queue_fellowship_challenge(uuid,text,uuid) to authenticated;

create or replace function public.respond_fellowship_challenge(p_challenge_id uuid,p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_ch public.fellowship_challenges%rowtype;
begin
  select * into v_ch from public.fellowship_challenges where id=p_challenge_id for update;
  if not found then raise exception 'Challenge not found.'; end if;
  if auth.uid() is null or v_ch.offered_to_id is distinct from auth.uid() then raise exception 'This offer is not assigned to you.'; end if;
  if v_ch.status<>'offered' or v_ch.expires_at is null or v_ch.expires_at<=now() then raise exception 'This offer has expired.'; end if;
  if not exists(select 1 from public.fellowship_room_members where room_id=v_ch.room_id and user_id=auth.uid() and left_at is null) then raise exception 'Join the room before responding.'; end if;
  update public.fellowship_challenges
  set status=case when p_accept then 'accepted'::public.fellowship_challenge_status else 'declined'::public.fellowship_challenge_status end,
      responded_at=now()
  where id=p_challenge_id;
  if not p_accept then perform public.advance_fellowship_challenge_queue(v_ch.room_id); end if;
end;
$$;
revoke all on function public.respond_fellowship_challenge(uuid,boolean) from public,anon;
grant execute on function public.respond_fellowship_challenge(uuid,boolean) to authenticated;
