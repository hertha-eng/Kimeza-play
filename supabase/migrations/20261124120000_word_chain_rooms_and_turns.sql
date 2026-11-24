-- Word Chain room and turn engine
alter table public.matches
  add column if not exists room_code text,
  add column if not exists game_state jsonb not null default '{}'::jsonb,
  add column if not exists max_players integer not null default 2,
  add column if not exists turn_duration_seconds integer not null default 30;

create unique index if not exists matches_room_code_unique on public.matches(room_code) where room_code is not null;

create or replace function private.word_chain_room_payload(p_match_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('id',m.id,'title',m.title,'game_code',m.game_code,'status',m.status,
    'room_code',m.room_code,'max_players',m.max_players,'turn_duration_seconds',m.turn_duration_seconds,
    'game_state',m.game_state,'players',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',mp.user_id,'display_name',p.display_name,'joined_at',mp.joined_at) order by mp.joined_at)
      from public.match_participants mp join public.profiles p on p.id=mp.user_id where mp.match_id=m.id),'[]'::jsonb))
  from public.matches m where m.id=p_match_id and exists(
    select 1 from public.match_participants mine where mine.match_id=m.id and mine.user_id=auth.uid())
$$;

create or replace function public.create_word_chain_room(p_title text default 'Word Chain',p_turn_seconds integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype; v_code text;
begin
 if v_user is null then raise exception 'Please sign in to create a room.'; end if;
 if not exists(select 1 from public.club_memberships cm where cm.user_id=v_user and cm.status='active') then raise exception 'An active club membership is required to play Kimeza games.'; end if;
 if p_turn_seconds not between 10 and 120 then raise exception 'Turn timer must be between 10 and 120 seconds.'; end if;
 loop v_code:=upper(substr(encode(gen_random_bytes(6),'hex'),1,6)); exit when not exists(select 1 from public.matches where room_code=v_code); end loop;
 insert into public.matches(title,game_code,status,is_official,created_by,room_code,max_players,turn_duration_seconds,game_state)
 values(left(coalesce(nullif(trim(p_title),''),'Word Chain'),60),'word_chain','open',false,v_user,v_code,2,p_turn_seconds,
 jsonb_build_object('words','[]'::jsonb,'current_turn_user_id',v_user,'turn_number',1,'started',false)) returning * into v_match;
 insert into public.match_participants(match_id,user_id,representation) values(v_match.id,v_user,'none');
 return private.word_chain_room_payload(v_match.id);
end $$;

create or replace function public.join_word_chain_room(p_room_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype;
begin
 if v_user is null then raise exception 'Please sign in to join a room.'; end if;
 if not exists(select 1 from public.club_memberships cm where cm.user_id=v_user and cm.status='active') then raise exception 'An active club membership is required to play Kimeza games.'; end if;
 select * into v_match from public.matches where room_code=upper(trim(p_room_code)) and game_code='word_chain' for update;
 if not found then raise exception 'That room code was not found.'; end if;
 if v_match.status not in ('open','in_progress') then raise exception 'This room is no longer accepting players.'; end if;
 if exists(select 1 from public.match_participants where match_id=v_match.id and user_id=v_user) then return private.word_chain_room_payload(v_match.id); end if;
 if (select count(*) from public.match_participants where match_id=v_match.id)>=v_match.max_players then raise exception 'This room is full.'; end if;
 insert into public.match_participants(match_id,user_id,representation) values(v_match.id,v_user,'none');
 return private.word_chain_room_payload(v_match.id);
end $$;

create or replace function public.start_word_chain_room(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_first uuid;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Room not found.'; end if;
 if v_match.created_by<>auth.uid() then raise exception 'Only the room creator can start this game.'; end if;
 if v_match.status<>'open' then raise exception 'This game has already started.'; end if;
 if (select count(*) from public.match_participants where match_id=p_match_id)<>2 then raise exception 'Two players must join before the game can start.'; end if;
 select user_id into v_first from public.match_participants where match_id=p_match_id order by joined_at limit 1;
 update public.matches set status='in_progress',starts_at=now(),
 game_state=game_state||jsonb_build_object('started',true,'current_turn_user_id',v_first,'turn_deadline',now()+make_interval(secs=>turn_duration_seconds)) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.submit_word_chain_word(p_match_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_word text; v_words jsonb; v_last text; v_next uuid; v_players uuid[];
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Game not found.'; end if;
 if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'current_turn_user_id')::uuid<>auth.uid() then raise exception 'It is not your turn yet.'; end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz<now() then raise exception 'Your turn time has expired.'; end if;
 v_word:=lower(trim(coalesce(p_word,'')));
 if v_word !~ '^[a-z]{2,24}$' then raise exception 'Enter one word using 2 to 24 letters.'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(v_match.game_state->'words','[]'::jsonb)) e where e->>'word'=v_word) then raise exception 'That word has already been used.'; end if;
 v_words:=coalesce(v_match.game_state->'words','[]'::jsonb);
 if jsonb_array_length(v_words)>0 then
 select e->>'word' into v_last from jsonb_array_elements(v_words) e order by (e->>'turn')::integer desc limit 1;
 if right(v_last,1)<>left(v_word,1) then raise exception 'Your word must start with the last letter of %.',v_last; end if; end if;
 select array_agg(user_id order by joined_at) into v_players from public.match_participants where match_id=p_match_id;
 v_next:=case when v_players[1]=auth.uid() then v_players[2] else v_players[1] end;
 v_words:=v_words||jsonb_build_array(jsonb_build_object('word',v_word,'user_id',auth.uid(),'turn',jsonb_array_length(v_words)+1,'played_at',now()));
 update public.matches set game_state=game_state||jsonb_build_object('words',v_words,'current_turn_user_id',v_next,
 'turn_number',jsonb_array_length(v_words)+1,'turn_deadline',now()+make_interval(secs=>turn_duration_seconds)) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;

create or replace function public.get_word_chain_room(p_match_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
 select private.word_chain_room_payload(p_match_id)
$$;

revoke all on function public.create_word_chain_room(text,integer) from public;
revoke all on function public.join_word_chain_room(text) from public;
revoke all on function public.start_word_chain_room(uuid) from public;
revoke all on function public.submit_word_chain_word(uuid,text) from public;
revoke all on function public.get_word_chain_room(uuid) from public;
grant execute on function public.create_word_chain_room(text,integer) to authenticated;
grant execute on function public.join_word_chain_room(text) to authenticated;
grant execute on function public.start_word_chain_room(uuid) to authenticated;
grant execute on function public.submit_word_chain_word(uuid,text) to authenticated;
grant execute on function public.get_word_chain_room(uuid) to authenticated;
