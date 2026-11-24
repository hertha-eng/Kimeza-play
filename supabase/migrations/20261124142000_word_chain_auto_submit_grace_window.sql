create or replace function public.submit_word_chain_word(p_match_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_word text; v_words jsonb; v_last text; v_next uuid; v_players uuid[]; v_now timestamptz:=clock_timestamp(); v_started timestamptz;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Game not found.'; end if;
 if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'match_deadline')::timestamptz<=v_now then raise exception 'The match time has ended.'; end if;
 if (v_match.game_state->>'current_turn_user_id')::uuid<>auth.uid() then raise exception 'It is not your turn yet.'; end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz+interval '2 seconds'<v_now then raise exception 'Your 10-second turn has expired.'; end if;
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
 v_words:=v_words||jsonb_build_array(jsonb_build_object('word',v_word,'user_id',auth.uid(),'turn',jsonb_array_length(v_words)+1,'played_at',v_now,'response_ms',greatest(0,(extract(epoch from (v_now-v_started))*1000)::integer)));
 update public.matches set game_state=game_state||jsonb_build_object('words',v_words,'current_turn_user_id',v_next,'turn_number',jsonb_array_length(v_words)+1,'turn_started_at',v_now,
 'typing_deadline',v_now+interval '3 seconds','turn_deadline',least(v_now+interval '10 seconds',(v_match.game_state->>'match_deadline')::timestamptz),'typing_started_by_user',false) where id=p_match_id;
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
 if (v_match.game_state->>'match_deadline')::timestamptz<=v_now then return public.finish_word_chain_match(p_match_id); end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz+interval '2 seconds'>v_now then raise exception 'The current turn has not expired.'; end if;
 select array_agg(user_id order by joined_at) into v_players from public.match_participants where match_id=p_match_id;
 v_next:=case when v_players[1]=(v_match.game_state->>'current_turn_user_id')::uuid then v_players[2] else v_players[1] end;
 v_missed:=coalesce(v_match.game_state->'missed_turns','{}'::jsonb);
 v_missed:=jsonb_set(v_missed,array[(v_match.game_state->>'current_turn_user_id')],to_jsonb(coalesce((v_missed->>(v_match.game_state->>'current_turn_user_id'))::integer,0)+1),true);
 update public.matches set game_state=game_state||jsonb_build_object('current_turn_user_id',v_next,'turn_started_at',v_now,'typing_deadline',v_now+interval '3 seconds',
 'turn_deadline',least(v_now+interval '10 seconds',(v_match.game_state->>'match_deadline')::timestamptz),'typing_started_by_user',false,'missed_turns',v_missed) where id=p_match_id;
 return private.word_chain_room_payload(p_match_id);
end $$;
