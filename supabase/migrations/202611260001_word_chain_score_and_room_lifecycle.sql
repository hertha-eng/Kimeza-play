-- Word Chain score compatibility, room lifecycle and scheduled cleanup.
-- Preserve the existing score model: casual Word Chain awards individual game points only.
alter table public.matches
  add column if not exists room_expires_at timestamptz;

update public.matches
set room_expires_at = created_at + interval '30 minutes'
where game_code = 'word_chain'
  and status = 'open'
  and room_expires_at is null;

create index if not exists matches_word_chain_open_expiry_idx
  on public.matches (room_expires_at)
  where game_code = 'word_chain' and status = 'open';

create or replace function private.word_chain_room_payload(p_match_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'title', m.title,
    'game_code', m.game_code,
    'status', m.status,
    'created_by', m.created_by,
    'room_code', m.room_code,
    'max_players', m.max_players,
    'turn_duration_seconds', m.turn_duration_seconds,
    'match_duration_seconds', m.match_duration_seconds,
    'room_expires_at', m.room_expires_at,
    'game_state', m.game_state,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', mp.user_id,
        'display_name', p.display_name,
        'joined_at', mp.joined_at
      ) order by mp.joined_at)
      from public.match_participants mp
      join public.profiles p on p.id = mp.user_id
      where mp.match_id = m.id
    ), '[]'::jsonb)
  )
  from public.matches m
  where m.id = p_match_id
    and exists (
      select 1 from public.match_participants mine
      where mine.match_id = m.id and mine.user_id = auth.uid()
    )
$$;

create or replace function private.expire_stale_word_chain_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.matches
  set status = 'cancelled',
      ended_at = clock_timestamp(),
      game_state = game_state || jsonb_build_object(
        'end_reason', 'room_expired',
        'expired_at', clock_timestamp()
      )
  where game_code = 'word_chain'
    and status = 'open'
    and room_expires_at is not null
    and room_expires_at <= clock_timestamp();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Accept the previous 10-second client payload during rollout, but always persist
-- the agreed 30-second turn duration in the database.
create or replace function public.create_word_chain_room(
  p_title text default 'Word Chain',
  p_turn_seconds integer default 30,
  p_match_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_match public.matches%rowtype;
  v_code text;
begin
  if v_user is null then
    raise exception 'Please sign in to create a room.';
  end if;

  if not exists (
    select 1 from public.club_memberships cm
    where cm.user_id = v_user and cm.status = 'active'
  ) then
    raise exception 'An active club membership is required to play Kimeza games.';
  end if;

  if coalesce(p_turn_seconds, 30) not in (10, 30) then
    raise exception 'Word Chain uses a 30-second turn.';
  end if;

  if p_match_seconds not in (120, 180, 300, 600, 900) then
    raise exception 'Choose a match length of 2, 3, 5, 10 or 15 minutes.';
  end if;

  perform private.expire_stale_word_chain_rooms();

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.matches where room_code = v_code
    );
  end loop;

  insert into public.matches (
    title, game_code, status, is_official, created_by, room_code,
    max_players, turn_duration_seconds, match_duration_seconds,
    room_expires_at, game_state
  )
  values (
    left(coalesce(nullif(trim(p_title), ''), 'Word Chain'), 60),
    'word_chain', 'open', false, v_user, v_code,
    2, 30, p_match_seconds,
    clock_timestamp() + interval '30 minutes',
    jsonb_build_object(
      'words', '[]'::jsonb,
      'current_turn_user_id', v_user,
      'turn_number', 1,
      'started', false
    )
  )
  returning * into v_match;

  insert into public.match_participants(match_id, user_id, representation)
  values (v_match.id, v_user, 'none');

  return private.word_chain_room_payload(v_match.id);
end;
$$;

create or replace function public.close_word_chain_room(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match
  from public.matches
  where id = p_match_id and game_code = 'word_chain'
  for update;

  if not found then
    raise exception 'Room not found.';
  end if;

  if v_match.created_by <> auth.uid() then
    raise exception 'Only the room creator can close this room.';
  end if;

  if v_match.status <> 'open' then
    raise exception 'Only an unstarted room can be closed.';
  end if;

  update public.matches
  set status = 'cancelled',
      ended_at = clock_timestamp(),
      game_state = game_state || jsonb_build_object(
        'end_reason', 'creator_closed',
        'closed_at', clock_timestamp()
      )
  where id = p_match_id;

  return private.word_chain_room_payload(p_match_id);
end;
$$;

-- Shared finalisation routine: called by a player or by the scheduled expiry job.
-- It writes only score_type='game' and destination_scope='none', never an
-- organisational leaderboard entry.
create or replace function private.finalize_word_chain_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_p public.match_participants%rowtype;
  v_a uuid;
  v_b uuid;
  v_count_a integer;
  v_count_b integer;
  v_winner uuid;
  v_fellowship_room_id uuid;
  v_challenge_id uuid;
begin
  select * into v_match
  from public.matches
  where id = p_match_id and game_code = 'word_chain'
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_match.status = 'completed' then
    return;
  end if;

  if v_match.status <> 'in_progress' then
    raise exception 'This game is not in progress.';
  end if;

  if v_match.game_state->>'match_deadline' is null
     or (v_match.game_state->>'match_deadline')::timestamptz > clock_timestamp() then
    raise exception 'The match timer has not ended.';
  end if;

  select user_id into v_a
  from public.match_participants
  where match_id = p_match_id
  order by joined_at
  limit 1;

  select user_id into v_b
  from public.match_participants
  where match_id = p_match_id and user_id <> v_a
  limit 1;

  if v_a is null or v_b is null then
    raise exception 'A Word Chain match must have two players to be finalised.';
  end if;

  select count(*) into v_count_a
  from jsonb_array_elements(coalesce(v_match.game_state->'words', '[]'::jsonb)) e
  where e->>'user_id' = v_a::text;

  select count(*) into v_count_b
  from jsonb_array_elements(coalesce(v_match.game_state->'words', '[]'::jsonb)) e
  where e->>'user_id' = v_b::text;

  v_winner := case
    when v_count_a > v_count_b then v_a
    when v_count_b > v_count_a then v_b
    else null
  end;

  update public.matches
  set status = 'completed',
      ended_at = clock_timestamp(),
      game_state = game_state || jsonb_build_object(
        'winner_user_id', v_winner,
        'end_reason', 'time_limit',
        'completed_at', clock_timestamp(),
        'final_counts', jsonb_build_object(v_a::text, v_count_a, v_b::text, v_count_b)
      )
  where id = p_match_id;

  for v_p in
    select * from public.match_participants where match_id = p_match_id
  loop
    insert into public.score_ledger (
      match_id, participant_id, player_id, points, score_type,
      destination_scope, destination_entity_id, rule_version, idempotency_key
    )
    values (
      p_match_id,
      v_p.id,
      v_p.user_id,
      case when v_winner is null then 1 when v_p.user_id = v_winner then 3 else 0 end,
      'game',
      'none',
      null,
      v_match.rule_version,
      'word-chain:' || p_match_id::text || ':' || v_p.user_id::text
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  v_fellowship_room_id := nullif(v_match.game_state->>'fellowship_room_id', '')::uuid;
  v_challenge_id := nullif(v_match.game_state->>'fellowship_challenge_id', '')::uuid;

  if v_fellowship_room_id is not null then
    update public.fellowship_challenges
    set status = 'completed'::public.fellowship_challenge_status,
        responded_at = clock_timestamp()
    where id = v_challenge_id and match_id = p_match_id;

    update public.fellowship_rooms
    set status = 'social'
    where id = v_fellowship_room_id and status = 'active_game';

    perform public.advance_fellowship_challenge_queue(v_fellowship_room_id);
  end if;
end;
$$;

create or replace function public.finish_word_chain_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.match_participants
    where match_id = p_match_id and user_id = auth.uid()
  ) then
    raise exception 'Only players in this room can finish the match.';
  end if;

  perform private.finalize_word_chain_match(p_match_id);
  return private.word_chain_room_payload(p_match_id);
end;
$$;

revoke all on function private.expire_stale_word_chain_rooms() from public, anon, authenticated;
revoke all on function private.finalize_word_chain_match(uuid) from public, anon, authenticated;
revoke all on function public.create_word_chain_room(text, integer, integer) from public, anon;
revoke all on function public.close_word_chain_room(uuid) from public, anon;
revoke all on function public.finish_word_chain_match(uuid) from public, anon;

grant execute on function public.create_word_chain_room(text, integer, integer) to authenticated;
grant execute on function public.close_word_chain_room(uuid) to authenticated;
grant execute on function public.finish_word_chain_match(uuid) to authenticated;

-- pg_cron runs every five minutes: expire abandoned lobby rooms and finalise
-- matches whose timed round has ended even if both players have left the app.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kimeza-word-chain-lifecycle') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'kimeza-word-chain-lifecycle';
  end if;
end;
$$;

select cron.schedule(
  'kimeza-word-chain-lifecycle',
  '*/5 * * * *',
  $job$
    select private.expire_stale_word_chain_rooms();
    select private.finalize_word_chain_match(m.id)
    from public.matches m
    where m.game_code = 'word_chain'
      and m.status = 'in_progress'
      and m.game_state->>'match_deadline' is not null
      and (m.game_state->>'match_deadline')::timestamptz <= clock_timestamp();
  $job$
);
