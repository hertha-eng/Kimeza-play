-- Keep invitation-code hashes inaccessible through the public Data API.
-- Trusted SECURITY DEFINER RPCs perform the validated create/redeem operations.
REVOKE ALL PRIVILEGES ON TABLE public.club_invitation_codes FROM anon, authenticated;
