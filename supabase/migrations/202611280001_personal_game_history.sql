-- Personal Game History
-- Members can retrieve only completed Word Play matches in which they participated.
-- Opponent details are limited to display names for those same matches.
-- The privileged reader lives in the non-exposed private schema.

create or replace function private.get_my_game_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_history jsonb;
begin
  if v_user_id is null then
    raise exception 'Please sign in to view your game history.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'match_id', m.id,
        'game_code', m.game_code,
        'game_name', 'Word Play',
        'title', m.title,
        'created_at', m.created_at,
        'ended_at', m.ended_at,
        'result',
          case
            when m.game_state ->> 'winner_user_id' is null then 'draw'
            when m.game_state ->> 'winner_user_id' = v_user_id::text then 'win'
            else 'loss'
          end,
        'points', coalesce(my_score.points, 0),
        'score_type', my_score.score_type,
        'representation', mine.representation::text,
        'represented_entity_id', mine.represented_entity_id,
        'destination_scope', my_score.destination_scope::text,
        'opponents', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'display_name', coalesce(p.display_name, 'Kimeza member')
              )
            ),
            '[]'::jsonb
          )
          from public.match_participants opponent
          left join public.profiles p on p.id = opponent.user_id
          where opponent.match_id = m.id
            and opponent.user_id <> v_user_id
        ),
        'details', jsonb_build_object(
          'words', coalesce(m.game_state -> 'words', '[]'::jsonb),
          'final_counts', coalesce(m.game_state -> 'final_counts', '{}'::jsonb),
          'end_reason', m.game_state ->> 'end_reason',
          'completed_at', m.game_state ->> 'completed_at'
        )
      )
      order by m.ended_at desc nulls last
    ),
    '[]'::jsonb
  )
  into v_history
  from public.matches m
  join public.match_participants mine
    on mine.match_id = m.id
   and mine.user_id = v_user_id
  left join public.score_ledger my_score
    on my_score.match_id = m.id
   and my_score.player_id = v_user_id
   and my_score.score_type = 'game'
  where m.game_code = 'word_chain'
    and m.status = 'completed';

  return v_history;
end;
$$;

revoke all on function private.get_my_game_history() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_my_game_history() to authenticated;

-- Exposed RPC wrapper runs with caller privileges and delegates to the
-- narrowly scoped private helper, which independently checks auth.uid().
create or replace function public.get_my_game_history()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_my_game_history();
$$;

revoke all on function public.get_my_game_history() from public, anon;
grant execute on function public.get_my_game_history() to authenticated;
