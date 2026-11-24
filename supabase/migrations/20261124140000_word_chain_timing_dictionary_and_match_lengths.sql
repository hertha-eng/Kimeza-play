-- Word Chain timed rounds, dictionary cache and configurable match length
alter table public.matches
  add column if not exists match_duration_seconds integer not null default 300;

create table if not exists public.word_chain_dictionary (
  word text primary key,
  verified_at timestamptz not null default now(),
  source text not null default 'dictionaryapi.dev'
);
alter table public.word_chain_dictionary enable row level security;
revoke all on public.word_chain_dictionary from anon, authenticated;

create or replace function public.create_word_chain_room(
  p_title text default 'Word Chain',
  p_turn_seconds integer default 10,
  p_match_seconds integer default 300
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype; v_code text;
begin
 if v_user is null then raise exception 'Please sign in to create a room.'; end if;
 if not exists(select 1 from public.club_memberships cm where cm.user_id=v_user and cm.status='active') then raise exception 'An active club membership is required to play Kimeza games.'; end if;
 if p_turn_seconds <> 10 then raise exception 'Word Chain uses a 10-second turn.'; end if;
 if p_match_seconds not in (120,180,300,600,900) then raise exception 'Choose a match length of 2, 3, 5, 10 or 15 minutes.'; end if;
 loop v_code:=upper(substr(encode(gen_random_bytes(6),'hex'),1,6)); exit when not exists(select 1 from public.matches where room_code=v_code); end loop;
 insert into public.matches(title,game_code,status,is_official,created_by,room_code,max_players,turn_duration_seconds,match_duration_seconds,game_state)
 values(left(coalesce(nullif(trim(p_title),''),'Word Chain'),60),'word_chain','open',false,v_user,v_code,2,10,p_match_seconds,
 jsonb_build_object('words','[]'::jsonb,'current_turn_user_id',v_user,'turn_number',1,'started',false)) returning * into v_match;
 insert into public.match_participants(match_id,user_id,representation) values(v_match.id,v_user,'none');
 return private.word_chain_room_payload(v_match.id);
end $$;

create or replace function public.start_word_chain_room(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_first uuid; v_now timestamptz:=clock_timestamp();
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Room not found.'; end if;
 if v_match.created_by<>auth.uid() then raise exception 'Only the room creator can start this game.'; end if;
 if v_match.status<>'open' then raise exception 'This game has already started.'; end if;
 if (select count(*) from public.match_participants where match_id=p_match_id)<>2 then raise exception 'Two players must join before the game can start.'; end if;
 select user_id into v_first from public.match_participants where match_id=p_match_id order by joined_at limit 1;
 update public.matches set status='in_progress',starts_at=v_now,
 game_state=game_state||jsonb_build_object('started',true,'current_turn_user_id',v_first,
 'match_deadline',v_now+make_interval(secs=>match_duration_seconds),
 'turn_started_at',v_now,'typing_deadline',v_now+interval '3 seconds',
 'turn_deadline',v_now+interval '10 seconds','typing_started_by_user',false,
 'missed_turns',jsonb_build_object())
 where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.begin_word_chain_turn(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found or v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'current_turn_user_id')::uuid<>auth.uid() then raise exception 'It is not your turn.'; end if;
 if clock_timestamp()>(v_match.game_state->>'typing_deadline')::timestamptz then raise exception 'You needed to start typing within 3 seconds.'; end if;
 update public.matches set game_state=game_state||jsonb_build_object('typing_started_by_user',true) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.submit_word_chain_word(p_match_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_word text; v_words jsonb; v_last text; v_next uuid; v_players uuid[]; v_now timestamptz:=clock_timestamp(); v_started timestamptz;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Game not found.'; end if;
 if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'match_deadline')::timestamptz<=v_now then raise exception 'The match time has ended.'; end if;
 if (v_match.game_state->>'current_turn_user_id')::uuid<>auth.uid() then raise exception 'It is not your turn yet.'; end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz<v_now then raise exception 'Your 10-second turn has expired.'; end if;
 if coalesce((v_match.game_state->>'typing_started_by_user')::boolean,false)=false then raise exception 'Start typing within the first 3 seconds.'; end if;
 v_word:=lower(trim(coalesce(p_word,'')));
 if v_word !~ '^[a-z]{2,24}$' then raise exception 'Enter one English word using 2 to 24 letters.'; end if;
 if not exists(select 1 from public.word_chain_dictionary d where d.word=v_word) then raise exception 'That word has not been verified in the English dictionary.'; end if;
 v_words:=coalesce(v_match.game_state->'words','[]'::jsonb);
 if exists(select 1 from jsonb_array_elements(v_words) e where e->>'word'=v_word) then raise exception 'That word has already been used.'; end if;
 if jsonb_array_length(v_words)>0 then
   select e->>'word' into v_last from jsonb_array_elements(v_words) e order by (e->>'turn')::integer desc limit 1;
   if right(v_last,1)<>left(v_word,1) then raise exception 'Your word must start with the last letter of %.',v_last; end if;
 end if;
 select array_agg(user_id order by joined_at) into v_players from public.match_participants where match_id=p_match_id;
 v_next:=case when v_players[1]=auth.uid() then v_players[2] else v_players[1] end;
 v_started:=(v_match.game_state->>'turn_started_at')::timestamptz;
 v_words:=v_words||jsonb_build_array(jsonb_build_object('word',v_word,'user_id',auth.uid(),
 'turn',jsonb_array_length(v_words)+1,'played_at',v_now,'response_ms',greatest(0,(extract(epoch from (v_now-v_started))*1000)::integer)));
 update public.matches set game_state=game_state||jsonb_build_object('words',v_words,'current_turn_user_id',v_next,
 'turn_number',jsonb_array_length(v_words)+1,'turn_started_at',v_now,
 'typing_deadline',v_now+interval '3 seconds','turn_deadline',least(v_now+interval '10 seconds',(v_match.game_state->>'match_deadline')::timestamptz),
 'typing_started_by_user',false) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.expire_word_chain_turn(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_next uuid; v_players uuid[]; v_now timestamptz:=clock_timestamp(); v_missed jsonb;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Game not found.'; end if;
 if not exists(select 1 from public.match_participants where match_id=p_match_id and user_id=auth.uid()) then raise exception 'Only players in this room can advance its turn.'; end if;
 if v_match.status='completed' then return private.word_chain_room_payload(p_match_id); end if;
 if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz>v_now and (v_match.game_state->>'match_deadline')::timestamptz>v_now then raise exception 'The current turn has not expired.'; end if;
 if (v_match.game_state->>'match_deadline')::timestamptz<=v_now then return public.finish_word_chain_match(p_match_id); end if;
 select array_agg(user_id order by joined_at) into v_players from public.match_participants where match_id=p_match_id;
 v_next:=case when v_players[1]=(v_match.game_state->>'current_turn_user_id')::uuid then v_players[2] else v_players[1] end;
 v_missed:=coalesce(v_match.game_state->'missed_turns','{}'::jsonb);
 v_missed:=jsonb_set(v_missed,array[(v_match.game_state->>'current_turn_user_id')],to_jsonb(coalesce((v_missed->>(v_match.game_state->>'current_turn_user_id'))::integer,0)+1),true);
 update public.matches set game_state=game_state||jsonb_build_object('current_turn_user_id',v_next,'turn_started_at',v_now,
 'typing_deadline',v_now+interval '3 seconds','turn_deadline',least(v_now+interval '10 seconds',(v_match.game_state->>'match_deadline')::timestamptz),
 'typing_started_by_user',false,'missed_turns',v_missed) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.finish_word_chain_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_p public.match_participants%rowtype; v_a uuid; v_b uuid; v_count_a integer; v_count_b integer; v_winner uuid;
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
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.pass_word_chain_turn(p_match_id uuid,p_reason text default 'timeout')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_players uuid[]; v_next uuid; v_now timestamptz:=clock_timestamp(); v_missed jsonb;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found or v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if not exists(select 1 from public.match_participants where match_id=p_match_id and user_id=auth.uid()) then raise exception 'Only players in this room can pass a turn.'; end if;
 if (v_match.game_state->>'current_turn_user_id')::uuid<>auth.uid() then raise exception 'Only the active player can pass this turn.'; end if;
 if p_reason='timeout' and (v_match.game_state->>'turn_deadline')::timestamptz>v_now then raise exception 'The turn has not expired.'; end if;
 if (v_match.game_state->>'match_deadline')::timestamptz<=v_now then return public.finish_word_chain_match(p_match_id); end if;
 select array_agg(user_id order by joined_at) into v_players from public.match_participants where match_id=p_match_id;
 v_next:=case when v_players[1]=auth.uid() then v_players[2] else v_players[1] end;
 v_missed:=coalesce(v_match.game_state->'missed_turns','{}'::jsonb);
 v_missed:=jsonb_set(v_missed,array[auth.uid()::text],to_jsonb(coalesce((v_missed->>auth.uid()::text)::integer,0)+1),true);
 update public.matches set game_state=game_state||jsonb_build_object('current_turn_user_id',v_next,'turn_started_at',v_now,
 'typing_deadline',v_now+interval '3 seconds','turn_deadline',least(v_now+interval '10 seconds',(v_match.game_state->>'match_deadline')::timestamptz),
 'typing_started_by_user',false,'missed_turns',v_missed,'last_turn_result',p_reason) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

revoke all on function public.create_word_chain_room(text,integer,integer) from public,anon;
revoke all on function public.start_word_chain_room(uuid) from public,anon;
revoke all on function public.begin_word_chain_turn(uuid) from public,anon;
revoke all on function public.submit_word_chain_word(uuid,text) from public,anon;
revoke all on function public.expire_word_chain_turn(uuid) from public,anon;
revoke all on function public.finish_word_chain_match(uuid) from public,anon;
revoke all on function public.pass_word_chain_turn(uuid,text) from public,anon;
grant execute on function public.create_word_chain_room(text,integer,integer) to authenticated;
grant execute on function public.start_word_chain_room(uuid) to authenticated;
grant execute on function public.begin_word_chain_turn(uuid) to authenticated;
grant execute on function public.submit_word_chain_word(uuid,text) to authenticated;
grant execute on function public.expire_word_chain_turn(uuid) to authenticated;
grant execute on function public.finish_word_chain_match(uuid) to authenticated;
grant execute on function public.pass_word_chain_turn(uuid,text) to authenticated;
