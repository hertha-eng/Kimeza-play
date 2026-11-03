create index if not exists buddy_group_members_user_id_idx on public.buddy_group_members(user_id);
create index if not exists buddy_groups_created_by_idx on public.buddy_groups(created_by);
create index if not exists match_participants_buddy_group_id_idx on public.match_participants(buddy_group_id);
create index if not exists match_participants_user_id_idx on public.match_participants(user_id);
