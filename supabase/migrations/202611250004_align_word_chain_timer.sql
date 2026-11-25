-- Align the Word Chain database turn duration with the 30-second game UI.
create or replace function public.create_word_chain_room(
  p_title text default 'Word Chain',
  p_turn_seconds integer default 30,
  p_match_seconds integer default 300
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype; v_code text;
begin
  if v_user is null then raise exception 'Please sign in to create a room.'; end if;
  if not exists(select 1 from public.club_memberships cm where cm.user_id=v_user and cm.status='active') then
    raise exception 'An active club membership is required to play Kimeza games.';
  end if;
  if p_turn_seconds<>30 then raise exception 'Word Chain uses a 30-second turn.'; end if;
  if p_match_seconds not in (120,180,300,600,900) then raise exception 'Choose a match length of 2, 3, 5, 10 or 15 minutes.'; end if;
  loop
    v_code:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.matches where room_code=v_code);
  end loop;
  insert into public.matches(title,game_code,status,is_official,created_by,room_code,max_players,turn_duration_seconds,match_duration_seconds,game_state)
  values(left(coalesce(nullif(trim(p_title),''),'Word Chain'),60),'word_chain','open',false,v_user,v_code,2,30,p_match_seconds,
    jsonb_build_object('words','[]'::jsonb,'current_turn_user_id',v_user,'turn_number',1,'started',false))
  returning * into v_match;
  insert into public.match_participants(match_id,user_id,representation) values(v_match.id,v_user,'none');
  return private.word_chain_room_payload(v_match.id);
end;
$$;
revoke all on function public.create_word_chain_room(text,integer,integer) from public,anon;
grant execute on function public.create_word_chain_room(text,integer,integer) to authenticated;

-- Ensure fellowship-created Word Chain matches use the same 30-second turn.
create or replace function public.launch_accepted_fellowship_challenge(p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_ch public.fellowship_challenges%rowtype; v_room public.fellowship_rooms%rowtype; v_match public.matches%rowtype; v_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into v_ch from public.fellowship_challenges where id=p_challenge_id for update;
  if not found then raise exception 'Challenge not found.'; end if;
  if v_ch.status<>'accepted' then raise exception 'This challenge has not been accepted.'; end if;
  if auth.uid() not in (v_ch.challenger_id,v_ch.offered_to_id) then raise exception 'Only the two players can launch this match.'; end if;
  if v_ch.match_id is not null then return private.word_chain_room_payload(v_ch.match_id); end if;
  if v_ch.game_code<>'word_chain' then raise exception 'This game is not connected to the live match engine yet.'; end if;
  select * into v_room from public.fellowship_rooms where id=v_ch.room_id for update;
  if not found or v_room.status<>'social' then raise exception 'The fellowship room is not ready to start a match.'; end if;
  if not exists(select 1 from public.fellowship_room_members where room_id=v_ch.room_id and user_id=v_ch.challenger_id and left_at is null)
    or not exists(select 1 from public.fellowship_room_members where room_id=v_ch.room_id and user_id=v_ch.offered_to_id and left_at is null) then
    raise exception 'Both players must still be present in the fellowship room.';
  end if;
  loop
    v_code:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
    exit when not exists(select 1 from public.matches where room_code=v_code);
  end loop;
  insert into public.matches(title,game_code,status,is_official,created_by,room_code,max_players,turn_duration_seconds,match_duration_seconds,game_state)
  values(left(v_room.title||' • Word Chain',60),'word_chain','open',false,v_ch.challenger_id,v_code,2,30,300,
    jsonb_build_object('words','[]'::jsonb,'current_turn_user_id',v_ch.challenger_id,'turn_number',1,'started',false,
      'fellowship_room_id',v_room.id,'fellowship_challenge_id',v_ch.id))
  returning * into v_match;
  insert into public.match_participants(match_id,user_id,representation)
  values(v_match.id,v_ch.challenger_id,'none'),(v_match.id,v_ch.offered_to_id,'none');
  update public.fellowship_challenges set match_id=v_match.id where id=v_ch.id;
  update public.fellowship_rooms set status='active_game' where id=v_room.id;
  return private.word_chain_room_payload(v_match.id);
end;
$$;
revoke all on function public.launch_accepted_fellowship_challenge(uuid) from public,anon;
grant execute on function public.launch_accepted_fellowship_challenge(uuid) to authenticated;
