-- Secure discovery for authenticated Kimeza members who are not yet in a room.
-- Returns only public room metadata; room conversations and member details remain protected.
create or replace function public.list_open_fellowship_rooms()
returns table (
  id uuid,
  club_id uuid,
  title text,
  status text,
  break_duration_seconds integer,
  opened_at timestamptz,
  club_name text,
  member_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    r.id,
    r.club_id,
    r.title,
    r.status::text,
    r.break_duration_seconds,
    r.opened_at,
    c.name as club_name,
    count(m.user_id) filter (where m.left_at is null) as member_count
  from public.fellowship_rooms r
  join public.clubs c on c.id = r.club_id
  left join public.fellowship_room_members m on m.room_id = r.id
  where r.status <> 'closed'
    and c.status = 'approved'
  group by r.id, r.club_id, r.title, r.status, r.break_duration_seconds, r.opened_at, c.name
  order by r.opened_at desc
  limit 50;
end;
$$;

revoke all on function public.list_open_fellowship_rooms() from public, anon;
grant execute on function public.list_open_fellowship_rooms() to authenticated;
