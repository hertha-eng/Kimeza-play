create index if not exists membership_history_approved_by_idx on public.membership_history(approved_by);
create index if not exists membership_history_initiated_by_idx on public.membership_history(initiated_by);
create index if not exists membership_history_new_club_id_idx on public.membership_history(new_club_id);
create index if not exists membership_history_old_club_id_idx on public.membership_history(old_club_id);
