-- Launch accepted fellowship challenges in the existing Word Chain engine.
create or replace function public.launch_accepted_fellowship_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ch public.fellowship_challenges%rowtype;
  v_room public.fellowship_rooms%rowtype;
  v_match public.matches%rowtype;
  v_code text;
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
  values(left(v_room.title||' • Word Chain',60),'word_chain','open',false,v_ch.challenger_id,v_code,2,10,300,
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

-- Return fellowship rooms to their social phase when a linked Word Chain match ends.
create or replace function public.finish_word_chain_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_p public.match_participants%rowtype;
  v_a uuid; v_b uuid; v_count_a integer; v_count_b integer; v_winner uuid;
  v_fellowship_room_id uuid; v_challenge_id uuid;
begin
  select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
  if not found then raise exception 'Game not found.'; end if;
  if not exists(select 1 from public.match_participants where match_id=p_match_id and user_id=auth.uid()) then raise exception 'Only players in this room can finish the match.'; end if;
  if v_match.status='completed' then return private.word_chain_room_payload(p_match_id); end if;
  if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
  if (v_match.game_state->>'match_deadline')::timestamptz>clock_timestamp() then raise exception 'The match timer has not ended.'; end if;
  select user_id into v_a from public.match_participants where match_id=p_match_id order by joined_at limit 1;
  select user_id into v_b from public.match_participants where match_id=p_match_id and user_id<>v_a limit 1;
  select count(*) into v_count_a from jsonb_array_elements(coalesce(v_match.game_state->'words','[]'::jsonb)) e where e->>'user_id'=v_a::text;
  select count(*) into v_count_b from jsonb_array_elements(coalesce(v_match.game_state->'words','[]'::jsonb)) e where e->>'user_id'=v_b::text;
  v_winner:=case when v_count_a>v_count_b then v_a when v_count_b>v_count_a then v_b else null end;
  update public.matches set status='completed',ended_at=clock_timestamp(),
    game_state=game_state||jsonb_build_object('winner_user_id',v_winner,'end_reason','time_limit','completed_at',clock_timestamp(),
    'final_counts',jsonb_build_object(v_a::text,v_count_a,v_b::text,v_count_b)) where id=p_match_id;
  for v_p in select * from public.match_participants where match_id=p_match_id loop
    insert into public.score_ledger(match_id,participant_id,player_id,points,score_type,destination_scope,destination_entity_id,rule_version,idempotency_key)
    values(p_match_id,v_p.id,v_p.user_id,case when v_winner is null then 1 when v_p.user_id=v_winner then 3 else 0 end,
      'word_chain_match','none',null,v_match.rule_version,'word-chain:'||p_match_id::text||':'||v_p.user_id::text)
    on conflict(idempotency_key) do nothing;
  end loop;
  v_fellowship_room_id:=nullif(v_match.game_state->>'fellowship_room_id','')::uuid;
  v_challenge_id:=nullif(v_match.game_state->>'fellowship_challenge_id','')::uuid;
  if v_fellowship_room_id is not null then
    update public.fellowship_challenges set status='completed'::public.fellowship_challenge_status,responded_at=clock_timestamp()
    where id=v_challenge_id and match_id=p_match_id;
    update public.fellowship_rooms set status='social' where id=v_fellowship_room_id and status='active_game';
    perform public.advance_fellowship_challenge_queue(v_fellowship_room_id);
  end if;
  return private.word_chain_room_payload(p_match_id);
end;
$$;
revoke all on function public.finish_word_chain_match(uuid) from public,anon;
grant execute on function public.finish_word_chain_match(uuid) to authenticated;
