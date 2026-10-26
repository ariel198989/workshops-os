-- 20261026_0010_ws_cycle_depth — curriculum v2 runtime: cycle depth (L0-L4), band, device modes,
-- template release status, student capabilities, anonymous concept checks (pre/post). Applied 2026-10-26.
-- Requires 0001..0009. Idempotent where practical.

-- ═══ 1. workshops: depth, band, device modes ═══
alter table public.ws_workshops
  add column if not exists cycle_depth text not null default 'L3',
  add column if not exists band text;
alter table public.ws_workshops drop constraint if exists ws_workshops_cycle_depth_check;
alter table public.ws_workshops add constraint ws_workshops_cycle_depth_check
  check (cycle_depth in ('L0', 'L1', 'L2', 'L3', 'L4'));
alter table public.ws_workshops drop constraint if exists ws_workshops_band_check;
alter table public.ws_workshops add constraint ws_workshops_band_check
  check (band is null or band in ('a-b', 'c-d', 'e-f', 'g-i', 'j-l', 'teachers', 'corporate', 'municipal'));
alter table public.ws_workshops drop constraint if exists ws_workshops_device_mode_check;
alter table public.ws_workshops add constraint ws_workshops_device_mode_check
  check (device_mode in ('own_phones', 'tablets_addon', 'mixed',
                         'facilitator_screen_only', 'school_tablet_capture_only', 'school_tablet_teacher_controlled',
                         'school_tablet_or_lab_pc', 'byod_phone_approved_lesson', 'laptop_plus_phone',
                         'teacher_laptop_offline_lan', 'travelling_kit', 'adult_laptop'));

grant insert (cycle_depth, band) on public.ws_workshops to authenticated;
grant update (cycle_depth, band) on public.ws_workshops to authenticated;

-- ═══ 2. templates: band, depth, default device, release status ═══
alter table public.ws_curriculum_templates
  add column if not exists band text,
  add column if not exists cycle_depth text,
  add column if not exists default_device_mode text,
  add column if not exists release_status text not null default 'live',
  add column if not exists ai_gate_note text,
  add column if not exists requires_product text[] not null default '{}';
alter table public.ws_curriculum_templates drop constraint if exists ws_tpl_band_check;
alter table public.ws_curriculum_templates add constraint ws_tpl_band_check
  check (band is null or band in ('a-b', 'c-d', 'e-f', 'g-i', 'j-l', 'teachers', 'corporate', 'municipal'));
alter table public.ws_curriculum_templates drop constraint if exists ws_tpl_depth_check;
alter table public.ws_curriculum_templates add constraint ws_tpl_depth_check
  check (cycle_depth is null or cycle_depth in ('L0', 'L1', 'L2', 'L3', 'L4'));
alter table public.ws_curriculum_templates drop constraint if exists ws_tpl_release_check;
alter table public.ws_curriculum_templates add constraint ws_tpl_release_check
  check (release_status in ('live', 'draft', 'blocked'));

update public.ws_curriculum_templates t set
  band = v.band, cycle_depth = v.depth, default_device_mode = v.device, release_status = v.rel,
  ai_gate_note = v.note, requires_product = v.req
from (values
  ('corewise-6-sessions', 'g-i', 'L3', 'school_tablet_or_lab_pc', 'live', null, '{}'::text[]),
  ('hackathon-day', 'g-i', 'L3', 'school_tablet_or_lab_pc', 'live', null, '{}'::text[]),
  ('corporate-half-day', 'corporate', 'L3', 'adult_laptop', 'live', null, '{}'::text[]),
  ('cv-ab-i-am-the-model', 'a-b', 'L0', 'facilitator_screen_only', 'draft',
   'הדגמה חיה של המדריך על מכשירו היא פרשנות להנחיות ה-AI (א-ג: אין כלי AI לתלמידים). עד אישור כתוב של המנהל והפיקוח התוכנית רצה במצב L0 מלא (ילד-רובוט במקום ההדגמה).', '{}'::text[]),
  ('cv-cd-teach-the-class-tablet', 'c-d', 'L1', 'school_tablet_capture_only', 'draft',
   'כיתה ג׳ ללא כלי AI, כיתה ד׳ בוט משרדי בלבד. הילדים מצלמים בלבד והמדריך מאמן על מכשירו. עד אישור כתוב: fallback L0 (עץ הקופים, התיוג הוא דעה).', '{}'::text[]),
  ('cv-ef-vision-lab', 'e-f', 'L2', 'school_tablet_teacher_controlled', 'live', null,
   array['click_a_point', 'parallel_training_queue', 'teacher_run_training']),
  ('cv-ef-hackathon-halfday', 'e-f', 'L2', 'school_tablet_teacher_controlled', 'blocked', null,
   array['click_a_point', 'parallel_training_queue', 'teacher_run_training']),
  ('cv-jl-client-track-8x90', 'j-l', 'L4', 'laptop_plus_phone', 'live', null, '{}'::text[]),
  ('cv-jl-hackathon-2day', 'j-l', 'L4', 'laptop_plus_phone', 'live', null, '{}'::text[]),
  ('cv-teachers-pd-30h', 'teachers', 'L3', 'adult_laptop', 'live', null, '{}'::text[]),
  ('cv-municipal-10-classes', 'municipal', 'L3', 'school_tablet_or_lab_pc', 'live', null, '{}'::text[]),
  ('cv-gi-research-club', 'j-l', 'L4', 'laptop_plus_phone', 'live', null, '{}'::text[])
) as v(slug, band, depth, device, rel, note, req)
where t.slug = v.slug;

-- existing workshops inherit from their template
update public.ws_workshops w set band = t.band, cycle_depth = coalesce(t.cycle_depth, w.cycle_depth)
from public.ws_curriculum_templates t where t.id = w.template_id and w.band is null;

-- ═══ 3. student capabilities derived from depth + device ═══
create or replace function public.ws_student_caps(p_depth text, p_device text)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select case p_depth
    when 'L0' then jsonb_build_object('can_capture', false, 'can_tag', false, 'tag_mode', 'none',
                     'can_train', false, 'can_view_model', false, 'metric_mode', 'yes_no')
    when 'L1' then jsonb_build_object('can_capture', p_device <> 'facilitator_screen_only', 'can_tag', false, 'tag_mode', 'none',
                     'can_train', false, 'can_view_model', false, 'metric_mode', 'x_of_10')
    when 'L2' then jsonb_build_object('can_capture', true, 'can_tag', true, 'tag_mode', 'point',
                     'can_train', false, 'can_view_model', true, 'metric_mode', 'score_1_10')
    when 'L4' then jsonb_build_object('can_capture', true, 'can_tag', true, 'tag_mode', 'box',
                     'can_train', true, 'can_view_model', true, 'metric_mode', 'map_pr')
    else jsonb_build_object('can_capture', true, 'can_tag', true, 'tag_mode', 'box',
                     'can_train', true, 'can_view_model', true, 'metric_mode', 'model_score')
  end;
$$;
grant execute on function public.ws_student_caps(text, text) to authenticated;

-- ═══ 4. anonymous concept checks (pre/post) ═══
create table if not exists public.ws_concept_responses (
  id                 uuid primary key default gen_random_uuid(),
  workshop_id        uuid not null references public.ws_workshops(id) on delete cascade,
  session_module_id  uuid not null references public.ws_session_modules(id) on delete cascade,
  phase              text not null check (phase in ('pre', 'post')),
  band               text,
  answers            jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at         timestamptz not null default now()
);
create index if not exists ws_concept_responses_ws_idx on public.ws_concept_responses (workshop_id, session_module_id, phase);
alter table public.ws_concept_responses enable row level security;
drop policy if exists ws_ccr_sel on public.ws_concept_responses;
create policy ws_ccr_sel on public.ws_concept_responses for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id));
revoke all on table public.ws_concept_responses from anon;
revoke insert, update, delete on table public.ws_concept_responses from authenticated;
grant select on table public.ws_concept_responses to authenticated;

-- the questions of a session module: first exercise that carries a `questions` array
create or replace function public.ws_internal_module_questions(p_content jsonb)
returns jsonb language sql immutable set search_path = public, pg_temp as $$
  select coalesce((select e -> 'questions' from jsonb_array_elements(coalesce(p_content -> 'exercises', '[]'::jsonb)) e
                    where e ? 'questions' limit 1), '[]'::jsonb);
$$;
revoke all on function public.ws_internal_module_questions(jsonb) from public, anon, authenticated;

create or replace function public.ws_submit_concept_check(p_session_module uuid, p_phase text, p_answers jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_sm public.ws_session_modules; v_w public.ws_workshops; v_n int;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_phase not in ('pre', 'post') then raise exception 'phase must be pre or post' using errcode = '22023'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be an object' using errcode = '22023';
  end if;
  select * into v_sm from public.ws_session_modules where id = p_session_module;
  if not found then raise exception 'module not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.ws_participants p
                  where p.workshop_id = v_sm.workshop_id and p.user_id = v_uid and p.status = 'active') then
    raise exception 'not a participant of this workshop' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = v_sm.workshop_id;
  select count(*) into v_n from jsonb_object_keys(p_answers);
  if v_n = 0 or v_n > 40 then raise exception 'answers out of range' using errcode = '22023'; end if;
  -- anonymous by design: no participant or user id is stored
  insert into public.ws_concept_responses (workshop_id, session_module_id, phase, band, answers)
  values (v_w.id, v_sm.id, p_phase, v_w.band, p_answers);
end $$;
revoke all on function public.ws_submit_concept_check(uuid, text, jsonb) from public, anon;
grant execute on function public.ws_submit_concept_check(uuid, text, jsonb) to authenticated;

-- staff aggregation: class counts only; percentages withheld under 15 respondents
create or replace function public.ws_concept_summary(p_workshop uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_out jsonb := '[]'::jsonb; v_g record; v_q record; v_items jsonb; v_n int; v_counts jsonb; v_correct int;
        v_opts int; v_i int; v_c int;
begin
  if not public.ws_is_workshop_staff(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for v_g in
    select sm.id as session_module_id, sm.title, r.phase, public.ws_internal_module_questions(sm.content) as questions
      from public.ws_session_modules sm
      join (select distinct session_module_id, phase from public.ws_concept_responses where workshop_id = p_workshop) r
        on r.session_module_id = sm.id
     where sm.workshop_id = p_workshop
     order by sm.title, r.phase
  loop
    select count(*) into v_n from public.ws_concept_responses
     where workshop_id = p_workshop and session_module_id = v_g.session_module_id and phase = v_g.phase;
    v_items := '[]'::jsonb;
    for v_q in select q, ord from jsonb_array_elements(v_g.questions) with ordinality as t(q, ord) loop
      v_opts := jsonb_array_length(coalesce(v_q.q -> 'options', '[]'::jsonb));
      v_counts := '[]'::jsonb;
      for v_i in 0 .. greatest(v_opts - 1, 0) loop
        select count(*) into v_c from public.ws_concept_responses
         where workshop_id = p_workshop and session_module_id = v_g.session_module_id and phase = v_g.phase
           and (answers ->> coalesce(v_q.q ->> 'id', (v_q.ord - 1)::text)) = v_i::text;
        v_counts := v_counts || to_jsonb(v_c);
      end loop;
      if jsonb_typeof(v_q.q -> 'answer') = 'number' then
        v_correct := (v_counts ->> (v_q.q ->> 'answer')::int)::int;
      else
        v_correct := null;
      end if;
      v_items := v_items || jsonb_build_object(
        'id', coalesce(v_q.q ->> 'id', (v_q.ord - 1)::text), 'q', v_q.q ->> 'q', 'options', v_q.q -> 'options',
        'answer', v_q.q -> 'answer', 'core', v_q.q ->> 'core', 'counts', v_counts, 'correct', v_correct,
        'correct_pct', case when v_correct is not null and v_n >= 15 then round(100.0 * v_correct / v_n) end);
    end loop;
    v_out := v_out || jsonb_build_object('session_module_id', v_g.session_module_id, 'module_title', v_g.title,
                                         'phase', v_g.phase, 'n', v_n, 'items', v_items);
  end loop;
  return v_out;
end $$;
revoke all on function public.ws_concept_summary(uuid) from public, anon;
grant execute on function public.ws_concept_summary(uuid) to authenticated;

-- ═══ 5. student context: depth, device, caps, concept checks ═══
create or replace function public.ws_my_context(p_workshop uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_p public.ws_participants; v_w public.ws_workshops;
begin
  select * into v_p from public.ws_participants
   where user_id = auth.uid() and status = 'active' and (p_workshop is null or workshop_id = p_workshop)
   order by created_at desc limit 1;
  if not found then return null; end if;
  select * into v_w from public.ws_workshops where id = v_p.workshop_id;
  return jsonb_build_object(
    'workshop', jsonb_build_object('id', v_w.id, 'title', v_w.title, 'format', v_w.format,
                   'starts_on', v_w.starts_on, 'ends_on', v_w.ends_on, 'status', v_w.status,
                   'cycle_depth', v_w.cycle_depth, 'band', v_w.band, 'device_mode', v_w.device_mode),
    'caps', public.ws_student_caps(v_w.cycle_depth, v_w.device_mode),
    'me', jsonb_build_object('participant_id', v_p.id, 'full_name', v_p.full_name, 'roles', v_p.roles),
    'group', (select jsonb_build_object('id', g.id, 'number', g.number, 'display_name', g.display_name,
                'team_name', g.team_name) from public.ws_groups g where g.id = v_p.group_id),
    'teammates', (select coalesce(jsonb_agg(jsonb_build_object('full_name', x.full_name, 'roles', x.roles)
                    order by x.full_name), '[]'::jsonb)
                  from public.ws_participants x
                  where v_p.group_id is not null and x.group_id = v_p.group_id and x.status = 'active'),
    'problem', (select jsonb_build_object('title', pr.title, 'statement', pr.statement, 'client_name', pr.client_name)
                from public.ws_problems pr where pr.workshop_id = v_p.workshop_id and pr.is_primary),
    'subproblem', (select jsonb_build_object('title', s.title, 'statement', s.statement, 'task_type', s.task_type,
                     'target_classes', to_jsonb(s.target_classes), 'success_metric', s.success_metric)
                   from public.ws_subproblems s join public.ws_groups g on g.subproblem_id = s.id
                   where g.id = v_p.group_id),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('session_no', s.session_no, 'title', s.title,
                   'kind', s.kind, 'scheduled_at', s.scheduled_at, 'status', s.status) order by s.session_no), '[]'::jsonb)
                 from public.ws_sessions s where s.workshop_id = v_p.workshop_id),
    'checks', (select coalesce(jsonb_agg(jsonb_build_object(
                   'session_module_id', sm.id, 'module_title', sm.title,
                   'module_slug', (select m.slug from public.ws_modules m where m.id = sm.module_id),
                   'phase_available', 'both',
                   'questions', public.ws_internal_module_questions(sm.content)) order by sm.title), '[]'::jsonb)
               from public.ws_session_modules sm
               where sm.workshop_id = v_p.workshop_id
                 and jsonb_array_length(public.ws_internal_module_questions(sm.content)) > 0),
    'progress', case when v_p.group_id is null then null
                     else public.ws_internal_group_stats(v_p.workshop_id, v_p.group_id) -> 0 end,
    'certificate', (select jsonb_build_object('certificate_no', c.certificate_no, 'issued_at', c.issued_at,
                      'pdf_path', c.pdf_path, 'status', c.status)
                    from public.ws_certificates c where c.participant_id = v_p.id));
end $$;
