create index if not exists club_invitation_codes_club_id_idx on public.club_invitation_codes(club_id);
create index if not exists club_invitation_codes_created_by_idx on public.club_invitation_codes(created_by);
create index if not exists clubs_created_by_idx on public.clubs(created_by);
create index if not exists matches_created_by_idx on public.matches(created_by);
