revoke execute on function public.create_word_chain_room(text,integer) from anon, public;
revoke execute on function public.join_word_chain_room(text) from anon, public;
revoke execute on function public.start_word_chain_room(uuid) from anon, public;
revoke execute on function public.submit_word_chain_word(uuid,text) from anon, public;
revoke execute on function public.get_word_chain_room(uuid) from anon, public;
revoke execute on function public.expire_word_chain_turn(uuid) from anon, public;

create or replace function public.expire_word_chain_turn(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_loser uuid; v_winner uuid; v_participant public.match_participants%rowtype;
begin
 select * into v_match from public.matches where id=p_match_id and game_code='word_chain' for update;
 if not found then raise exception 'Game not found.'; end if;
 if not exists(select 1 from public.match_participants where match_id=p_match_id and user_id=auth.uid()) then
   raise exception 'Only players in this room can complete the match.';
 end if;
 if v_match.status='completed' then return private.word_chain_room_payload(p_match_id); end if;
 if v_match.status<>'in_progress' then raise exception 'This game is not in progress.'; end if;
 if (v_match.game_state->>'turn_deadline')::timestamptz > now() then raise exception 'The current turn has not expired.'; end if;
 v_loser:=(v_match.game_state->>'current_turn_user_id')::uuid;
 select user_id into v_winner from public.match_participants where match_id=p_match_id and user_id<>v_loser limit 1;
 if v_winner is null then raise exception 'The opponent could not be identified.'; end if;
 update public.matches set status='completed',ended_at=now(),
 game_state=game_state||jsonb_build_object('winner_user_id',v_winner,'loser_user_id',v_loser,'end_reason','turn_timeout','completed_at',now())
 where id=p_match_id;
 for v_participant in select * from public.match_participants where match_id=p_match_id loop
   insert into public.score_ledger(match_id,participant_id,player_id,points,score_type,destination_scope,destination_entity_id,rule_version,idempotency_key)
   values(p_match_id,v_participant.id,v_participant.user_id,
     case when v_participant.user_id=v_winner then 3 else 0 end,
     'word_chain_match','none',null,v_match.rule_version,
     'word-chain:'||p_match_id::text||':'||v_participant.user_id::text)
   on conflict(idempotency_key) do nothing;
 end loop;
 return private.word_chain_room_payload(p_match_id);
end $$;
revoke execute on function public.expire_word_chain_turn(uuid) from anon, public;
grant execute on function public.expire_word_chain_turn(uuid) to authenticated;