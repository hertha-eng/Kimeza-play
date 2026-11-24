drop function if exists public.create_word_chain_room(text,integer);
create or replace function private.word_chain_room_payload(p_match_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
 select jsonb_build_object('id',m.id,'title',m.title,'game_code',m.game_code,'status',m.status,
 'room_code',m.room_code,'max_players',m.max_players,'turn_duration_seconds',m.turn_duration_seconds,
 'match_duration_seconds',m.match_duration_seconds,'game_state',m.game_state,
 'players',coalesce((select jsonb_agg(jsonb_build_object('user_id',mp.user_id,'display_name',p.display_name,'joined_at',mp.joined_at) order by mp.joined_at)
 from public.match_participants mp join public.profiles p on p.id=mp.user_id where mp.match_id=m.id),'[]'::jsonb))
 from public.matches m where m.id=p_match_id and exists(select 1 from public.match_participants mine where mine.match_id=m.id and mine.user_id=auth.uid())
$$;
