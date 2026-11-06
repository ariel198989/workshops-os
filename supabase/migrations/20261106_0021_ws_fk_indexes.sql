-- 20261106_0021_ws_fk_indexes — covering indexes for the foreign keys on the hot paths (advisor 0001).
create index if not exists ws_participants_group_wid_idx on public.ws_participants (group_id, workshop_id);
create index if not exists ws_photos_group_wid_idx on public.ws_photos (group_id, workshop_id);
create index if not exists ws_models_group_wid_idx on public.ws_models (group_id, workshop_id);
create index if not exists ws_attendance_part_wid_idx on public.ws_attendance (participant_id, workshop_id);
create index if not exists ws_attendance_sess_wid_idx on public.ws_attendance (session_id, workshop_id);
create index if not exists ws_certificates_part_wid_idx on public.ws_certificates (participant_id, workshop_id);
create index if not exists ws_deliverables_group_wid_idx on public.ws_deliverables (group_id, workshop_id);
create index if not exists ws_session_modules_sess_wid_idx on public.ws_session_modules (session_id, workshop_id);
create index if not exists ws_session_modules_module_idx on public.ws_session_modules (module_id);
create index if not exists ws_concept_responses_smod_idx on public.ws_concept_responses (session_module_id);
create index if not exists ws_live_state_smod_idx on public.ws_live_state (session_module_id);
