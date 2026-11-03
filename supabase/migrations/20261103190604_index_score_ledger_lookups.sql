create index if not exists score_ledger_match_id_idx on public.score_ledger(match_id);
create index if not exists score_ledger_participant_id_idx on public.score_ledger(participant_id);
create index if not exists score_ledger_reverses_entry_id_idx on public.score_ledger(reverses_entry_id);
