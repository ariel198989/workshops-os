-- 20261106_0019b_ws_hide_participant_notes — closes M3: a student reading their own ws_participants row
-- no longer sees the staff's notes or custom_fields. Staff read them through ws_participant_private (0019).
-- Run only after the console selects explicit columns (workshops-os de64068).
revoke select on public.ws_participants from authenticated;
grant select (id, workshop_id, group_id, user_id, full_name, grade, roles, status, source, media_consent,
              joined_at, created_at, updated_at) on public.ws_participants to authenticated;
