-- 20261031_0011_ws_hardening_e2e — fixes from the 31/10/2026 end-to-end audit (15 agents + SQL journey).
-- Applied 2026-10-31 as ws_0011_hardening_e2e.
--
-- 1  ws_clone_template copies the 0010 gate columns and the copy is a draft
-- 2  template gate columns change only by admins (trigger; UI gate was the only guard)
-- 3  ws_instantiate_curriculum: blocked templates refused (P0003), phones refused for a-b/c-d (P0004),
--    session times kept in the workshop timezone across DST
-- 4  sc_training_jobs: 'failed' status, started_at, failure_reason; requester may cancel own job;
--    anon loses read; staff RPC ws_fail_training_job
-- 5  sc_* writes scoped to the caller's own workshop group (ws_team_writable)
-- 6  ws_tag_detection: live workshop + can_tag only, 'photo already handled' = P0002, undo of a reject, events
-- 7  ws_my_context: checks carry phase_available pre|post|both and never the correct answer
-- 8  ws_submit_concept_check: payload cap, one submission per user+module+phase via a one-way ledger,
--    day-rounded timestamps, no direct reads of responses
-- 9  join: throttle (P0005), capacity (P0006), withdrawn cannot self-reactivate, name sanitised
-- 10 random join code by default
-- 11 ws_verify_certificate: revoked returns only {valid:false,status:'revoked'}
-- 12 ws_groups / ws_problems readable by staff only (students get theirs through ws_my_context)
-- 13 ws_purge_workshop_media: admin deletes a finished workshop's photos and job rows

-- ── 1. clone keeps band / depth / device / gate note / product list, copy is draft ─────────────
create or replace function public.ws_clone_template(p_template uuid, p_title text, p_slug text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_new uuid;
begin
  if not public.ws_is_core_staff() then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.ws_curriculum_templates (slug, title, description, format, default_group_size, parent_template_id,
                                              created_by, band, cycle_depth, default_device_mode, ai_gate_note,
                                              requires_product, release_status)
  select p_slug, p_title, description, format, default_group_size, id, auth.uid(),
         band, cycle_depth, default_device_mode, ai_gate_note, requires_product, 'draft'
    from public.ws_curriculum_templates where id = p_template
  returning id into v_new;
  if v_new is null then raise exception 'template not found' using errcode = 'P0002'; end if;
  insert into public.ws_template_modules (template_id, module_id, session_no, position, session_title,
                                          session_kind, duration_override, notes)
  select v_new, module_id, session_no, position, session_title, session_kind, duration_override, notes
    from public.ws_template_modules where template_id = p_template;
  return v_new;
end $$;

-- ── 2. gate columns: admins only (SQL editor / service role have no JWT and pass) ──────────────
create or replace function public.ws_templates_gate_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() = 'authenticated' and not public.ws_is_admin() and (
       new.release_status       is distinct from old.release_status
    or new.band                 is distinct from old.band
    or new.cycle_depth          is distinct from old.cycle_depth
    or new.default_device_mode  is distinct from old.default_device_mode
    or new.ai_gate_note         is distinct from old.ai_gate_note
    or new.requires_product     is distinct from old.requires_product) then
    raise exception 'only admins change template gates' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists ws_templates_gate_guard on public.ws_curriculum_templates;
create trigger ws_templates_gate_guard before update on public.ws_curriculum_templates
  for each row execute function public.ws_templates_gate_guard();

-- ── 3. instantiate: gates + timezone-stable schedule ──────────────────────────────────────────
create or replace function public.ws_instantiate_curriculum(
  p_workshop uuid, p_template uuid default null,
  p_first_session timestamptz default null, p_interval interval default interval '7 days')
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_t uuid; v_tpl public.ws_curriculum_templates; v_r record; v_sid uuid; v_idx int := 0;
        v_tz text;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = p_workshop for update;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.ws_sessions where workshop_id = p_workshop) then
    raise exception 'workshop already has sessions — edit them instead' using errcode = '23505';
  end if;
  v_t := coalesce(p_template, v_w.template_id,
         (select id from public.ws_curriculum_templates
           where is_default and not is_archived and format = v_w.format limit 1));
  if v_t is null then raise exception 'no template for format %', v_w.format using errcode = 'P0002'; end if;
  select * into v_tpl from public.ws_curriculum_templates where id = v_t;
  if v_tpl.release_status = 'blocked' then
    raise exception 'template_blocked' using errcode = 'P0003';
  end if;
  if v_w.band in ('a-b', 'c-d') and v_w.device_mode in ('own_phones', 'laptop_plus_phone') then
    raise exception 'device_not_allowed_for_band' using errcode = 'P0004';
  end if;
  v_tz := coalesce(nullif(v_w.timezone, ''), 'Asia/Jerusalem');

  for v_r in
    select tm.session_no, max(tm.session_title) as title, max(tm.session_kind) as kind,
           sum(coalesce(tm.duration_override, m.duration_minutes)) as dur
      from public.ws_template_modules tm join public.ws_modules m on m.id = tm.module_id
     where tm.template_id = v_t
     group by tm.session_no order by tm.session_no
  loop
    insert into public.ws_sessions (workshop_id, session_no, title, kind, duration_minutes, scheduled_at, status)
    values (p_workshop, v_r.session_no, coalesce(v_r.title, 'מפגש ' || v_r.session_no),
            coalesce(v_r.kind, 'regular'), greatest(15, least(720, v_r.dur)),
            case when p_first_session is null then null
                 else ((p_first_session at time zone v_tz) + (v_idx * p_interval)) at time zone v_tz end,
            case when p_first_session is null then 'planned' else 'scheduled' end)
    returning id into v_sid;

    insert into public.ws_session_modules (session_id, workshop_id, module_id, module_version, position,
                                           title, module_type, duration_minutes, pipeline_stage, content)
    select v_sid, p_workshop, m.id, m.version,
           (row_number() over (order by tm.position))::smallint,
           m.title, m.module_type, coalesce(tm.duration_override, m.duration_minutes), m.pipeline_stage,
           jsonb_build_object('summary', m.summary, 'objectives', to_jsonb(m.objectives),
             'exercises', m.exercises, 'materials', m.materials,
             'facilitator_notes', m.facilitator_notes, 'template_notes', tm.notes)
      from public.ws_template_modules tm join public.ws_modules m on m.id = tm.module_id
     where tm.template_id = v_t and tm.session_no = v_r.session_no;
    v_idx := v_idx + 1;
  end loop;

  update public.ws_workshops set template_id = v_t where id = p_workshop;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'curriculum.instantiated', 'ws_curriculum_templates', v_t, jsonb_build_object('sessions', v_idx));
  return v_idx;
end $$;

-- ── 4. training jobs: failed state, ownership, no anon reads ──────────────────────────────────
alter table public.sc_training_jobs drop constraint if exists sc_training_jobs_status_check;
alter table public.sc_training_jobs
  add constraint sc_training_jobs_status_check check (status in ('pending', 'running', 'done', 'cancelled', 'failed'));
alter table public.sc_training_jobs
  add column if not exists started_at timestamptz,
  add column if not exists failure_reason text;

drop policy if exists sc_jobs_upd on public.sc_training_jobs;
create policy sc_jobs_upd_own on public.sc_training_jobs for update to authenticated
  using (requested_by = auth.uid() or public.is_thinkcv_admin())
  with check ((requested_by = auth.uid() and status in ('cancelled', 'done')) or public.is_thinkcv_admin());
drop policy if exists sc_jobs_read on public.sc_training_jobs;
create policy sc_jobs_read on public.sc_training_jobs for select to authenticated using (true);
revoke all on public.sc_training_jobs from anon;

create or replace function public.ws_fail_training_job(p_job uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team text; v_status text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select team_name, status into v_team, v_status from public.sc_training_jobs where id = p_job;
  if v_team is null then raise exception 'job not found' using errcode = 'P0002'; end if;
  if not (public.ws_is_core_staff() or exists (
      select 1 from public.ws_groups g
       where public.ws_is_workshop_staff(g.workshop_id) and v_team in (g.team_name, 'אישי · ' || g.team_name))) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'running') then raise exception 'job is not active' using errcode = '22023'; end if;
  update public.sc_training_jobs
     set status = 'failed', failure_reason = left(coalesce(p_reason, ''), 200), completed_at = now()
   where id = p_job;
end $$;
revoke all on function public.ws_fail_training_job(uuid, text) from public, anon;
grant execute on function public.ws_fail_training_job(uuid, text) to authenticated;

-- ── 5. sc_* writes: a workshop team name may be used only by its own members or staff ─────────
create or replace function public.ws_team_writable(p_team text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_team is null
      or not exists (select 1 from public.ws_groups g where p_team in (g.team_name, 'אישי · ' || g.team_name))
      or exists (select 1 from public.ws_participants p join public.ws_groups g on g.id = p.group_id
                  where p.user_id = auth.uid() and p.status = 'active'
                    and p_team in (g.team_name, 'אישי · ' || g.team_name))
      or exists (select 1 from public.ws_groups g
                  where p_team in (g.team_name, 'אישי · ' || g.team_name) and public.ws_is_workshop_staff(g.workshop_id));
$$;
revoke all on function public.ws_team_writable(text) from public, anon;
grant execute on function public.ws_team_writable(text) to authenticated;

drop policy if exists sc_detections_ins on public.sc_detections;
create policy sc_detections_ins on public.sc_detections for insert to public
  with check (auth.uid() is not null and detected_by = auth.uid()
              and status in ('pending', 'dataset') and public.ws_team_writable(team_name));
drop policy if exists sc_jobs_ins on public.sc_training_jobs;
create policy sc_jobs_ins on public.sc_training_jobs for insert to authenticated
  with check (requested_by = auth.uid() and public.ws_team_writable(team_name));
drop policy if exists sc_models_ins on public.sc_models;
create policy sc_models_ins on public.sc_models for insert to authenticated
  with check (owner = auth.uid() and public.ws_team_writable(team_name));

-- ── 6. tagging: live + capability, undo of a reject, events ───────────────────────────────────
drop function if exists public.ws_internal_tag_apply(uuid, jsonb, text, boolean);
create or replace function public.ws_internal_tag_apply(p_id uuid, p_bbox jsonb, p_class text, p_reject boolean, p_restore boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_claims text := current_setting('request.jwt.claims', true);
        v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    if p_restore then
      update public.sc_detections set status = 'dataset' where id = p_id;
    elsif p_reject then
      update public.sc_detections set status = 'rejected' where id = p_id;
    else
      update public.sc_detections set bbox = p_bbox, class_name = coalesce(p_class, class_name) where id = p_id;
    end if;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
end $$;
revoke all on function public.ws_internal_tag_apply(uuid, jsonb, text, boolean, boolean) from public, anon, authenticated;

create or replace function public.ws_tag_detection(p_id uuid, p_bbox jsonb, p_class text, p_reject boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team text; v_status text; v_class text := nullif(btrim(coalesce(p_class, '')), ''); v_box jsonb;
        v_wid uuid; v_wstatus text; v_depth text; v_device text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select team_name, status into v_team, v_status from public.sc_detections where id = p_id;
  if v_team is null then raise exception 'photo not found' using errcode = 'P0002'; end if;
  select g.workshop_id into v_wid
    from public.ws_participants p join public.ws_groups g on g.id = p.group_id
   where p.user_id = auth.uid() and p.status = 'active'
     and v_team in (g.team_name, 'אישי · ' || g.team_name)
   limit 1;
  if v_wid is null then raise exception 'photo is not from your group' using errcode = '42501'; end if;
  select status, cycle_depth, device_mode into v_wstatus, v_depth, v_device from public.ws_workshops where id = v_wid;
  if v_wstatus <> 'live' then raise exception 'workshop not live' using errcode = '42501'; end if;
  if not coalesce((public.ws_student_caps(v_depth, v_device) ->> 'can_tag')::boolean, false) then
    raise exception 'tagging is not enabled for this workshop' using errcode = '42501';
  end if;

  -- undo of "no object": restore a rejected photo
  if not p_reject and p_bbox is null and v_class is null then
    if v_status <> 'rejected' then raise exception 'photo already handled' using errcode = 'P0002'; end if;
    perform public.ws_internal_tag_apply(p_id, null, null, false, true);
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (v_wid, 'photo.restored', 'sc_detections', p_id, jsonb_build_object('team', v_team));
    return;
  end if;
  if v_status not in ('dataset', 'pending') then
    raise exception 'photo already handled' using errcode = 'P0002';
  end if;

  if p_reject then
    perform public.ws_internal_tag_apply(p_id, null, null, true);
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (v_wid, 'photo.rejected', 'sc_detections', p_id, jsonb_build_object('team', v_team));
    return;
  end if;
  if p_bbox is null or jsonb_typeof(p_bbox) <> 'object'
     or not (p_bbox ? 'x' and p_bbox ? 'y' and p_bbox ? 'w' and p_bbox ? 'h')
     or (p_bbox->>'w')::numeric <= 0 or (p_bbox->>'h')::numeric <= 0
     or (p_bbox->>'x')::numeric < 0 or (p_bbox->>'y')::numeric < 0
     or (p_bbox->>'x')::numeric + (p_bbox->>'w')::numeric > 1.0001
     or (p_bbox->>'y')::numeric + (p_bbox->>'h')::numeric > 1.0001 then
    raise exception 'bbox must be normalized {x,y,w,h} inside the frame' using errcode = '22023';
  end if;
  if v_class is not null and (v_class ~ '[''"\n\r]' or char_length(v_class) > 40) then
    raise exception 'class names: max 40 chars, no quotes/newlines' using errcode = '22023';
  end if;
  v_box := jsonb_build_object('x', (p_bbox->>'x')::numeric, 'y', (p_bbox->>'y')::numeric,
                              'w', (p_bbox->>'w')::numeric, 'h', (p_bbox->>'h')::numeric);
  perform public.ws_internal_tag_apply(p_id, v_box, v_class, false);
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_wid, 'photo.tagged', 'sc_detections', p_id, jsonb_build_object('team', v_team, 'class', v_class));
end $$;
revoke all on function public.ws_tag_detection(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.ws_tag_detection(uuid, jsonb, text, boolean) to authenticated;

-- ── 7. student context: pre/post per position, correct answers masked ─────────────────────────
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
                   'session_module_id', c.id, 'module_title', c.title, 'module_slug', c.slug,
                   'phase_available', case when c.n = 1 then 'both'
                                           when c.session_no = c.mn then 'pre'
                                           when c.session_no = c.mx then 'post'
                                           else 'both' end,
                   'questions', (select coalesce(jsonb_agg(
                                   case when jsonb_typeof(q -> 'answer') = 'number' then q || '{"answer": -1}'::jsonb else q end
                                   order by ord), '[]'::jsonb)
                                 from jsonb_array_elements(c.questions) with ordinality as t(q, ord))
                 ) order by c.session_no, c.title), '[]'::jsonb)
               from (select sm.id, sm.title, s.session_no,
                            (select m.slug from public.ws_modules m where m.id = sm.module_id) as slug,
                            public.ws_internal_module_questions(sm.content) as questions,
                            min(s.session_no) over () as mn, max(s.session_no) over () as mx, count(*) over () as n
                       from public.ws_session_modules sm join public.ws_sessions s on s.id = sm.session_id
                      where sm.workshop_id = v_p.workshop_id
                        and jsonb_array_length(public.ws_internal_module_questions(sm.content)) > 0) c),
    'progress', case when v_p.group_id is null then null
                     else public.ws_internal_group_stats(v_p.workshop_id, v_p.group_id) -> 0 end,
    'certificate', (select jsonb_build_object('certificate_no', c.certificate_no, 'issued_at', c.issued_at,
                      'pdf_path', c.pdf_path, 'status', c.status)
                    from public.ws_certificates c where c.participant_id = v_p.id));
end $$;

-- ── 8. concept checks: cap, one submission per user+module+phase, day-rounded, no direct reads ─
create table if not exists public.ws_concept_ledger (
  h text primary key,
  created_at timestamptz not null default now()
);
alter table public.ws_concept_ledger enable row level security;
revoke all on public.ws_concept_ledger from public, anon, authenticated;

create or replace function public.ws_submit_concept_check(p_session_module uuid, p_phase text, p_answers jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_sm public.ws_session_modules; v_w public.ws_workshops; v_n int; v_h text;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_phase not in ('pre', 'post') then raise exception 'phase must be pre or post' using errcode = '22023'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be an object' using errcode = '22023';
  end if;
  if length(p_answers::text) > 4000 then raise exception 'answers too large' using errcode = '22023'; end if;
  select * into v_sm from public.ws_session_modules where id = p_session_module;
  if not found then raise exception 'module not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.ws_participants p
                  where p.workshop_id = v_sm.workshop_id and p.user_id = v_uid and p.status = 'active') then
    raise exception 'not a participant of this workshop' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = v_sm.workshop_id;
  select count(*) into v_n from jsonb_object_keys(p_answers);
  if v_n = 0 or v_n > 40 then raise exception 'answers out of range' using errcode = '22023'; end if;
  -- one-way ledger: proves "this account already answered" without linking answers to the account
  v_h := encode(extensions.digest(v_uid::text || ':' || p_session_module::text || ':' || p_phase, 'sha256'), 'hex');
  insert into public.ws_concept_ledger (h) values (v_h) on conflict do nothing;
  if not found then raise exception 'already submitted' using errcode = '23505'; end if;
  -- anonymous by design: no participant or user id is stored; timestamp rounded to the day
  insert into public.ws_concept_responses (workshop_id, session_module_id, phase, band, answers, created_at)
  values (v_w.id, v_sm.id, p_phase, v_w.band, p_answers, date_trunc('day', now()));
end $$;
revoke all on function public.ws_submit_concept_check(uuid, text, jsonb) from public, anon;
grant execute on function public.ws_submit_concept_check(uuid, text, jsonb) to authenticated;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'ws_concept_responses' loop
    execute format('drop policy if exists %I on public.ws_concept_responses', r.policyname);
  end loop;
end $$;
revoke all on public.ws_concept_responses from public, anon, authenticated;

-- ── 9. join: throttle, capacity, withdrawn, sanitised name ─────────────────────────────────────
create table if not exists public.ws_join_attempts (
  id bigserial primary key,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists ws_join_attempts_user_time on public.ws_join_attempts (user_id, created_at);
alter table public.ws_join_attempts enable row level security;
revoke all on public.ws_join_attempts from public, anon, authenticated;

create or replace function public.ws_internal_throttle(p_user uuid, p_max int default 10, p_window interval default interval '15 minutes')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int;
begin
  insert into public.ws_join_attempts (user_id) values (p_user);
  select count(*) into v_n from public.ws_join_attempts where user_id = p_user and created_at > now() - p_window;
  if v_n > p_max then raise exception 'too many attempts, try again later' using errcode = 'P0005'; end if;
  if random() < 0.02 then delete from public.ws_join_attempts where created_at < now() - interval '1 day'; end if;
end $$;
revoke all on function public.ws_internal_throttle(uuid, int, interval) from public, anon, authenticated;

create or replace function public.ws_find_workshop(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return null; end if;
  perform public.ws_internal_throttle(auth.uid());
  return (
    select jsonb_build_object(
      'id', w.id, 'title', w.title, 'code', w.code, 'organization', o.name, 'status', w.status,
      'groups', coalesce((select jsonb_agg(jsonb_build_object(
          'id', g.id, 'number', g.number, 'display_name', g.display_name,
          'members', (select count(*) from public.ws_participants p where p.group_id = g.id and p.status = 'active'),
          'capacity', g.capacity) order by g.number)
        from public.ws_groups g where g.workshop_id = w.id and g.sc_class_id is not null), '[]'::jsonb))
    from public.ws_workshops w join public.ws_organizations o on o.id = w.organization_id
    where upper(w.code) = upper(btrim(p_code)) and w.status = 'live');
end $$;
revoke all on function public.ws_find_workshop(text) from public, anon;
grant execute on function public.ws_find_workshop(text) to authenticated;

create or replace function public.ws_join_group(p_code text, p_group uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_w public.ws_workshops; v_g public.ws_groups; v_p public.ws_participants;
        v_name text; v_members int;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform public.ws_internal_throttle(v_uid);
  -- strip control, zero-width and bidi-override characters, then trim and cap
  v_name := left(btrim(regexp_replace(coalesce(p_full_name, ''),
            E'[\x01-\x1F\x7F​-‏‪-‮⁦-⁩]', '', 'g')), 80);
  if char_length(v_name) < 2 then raise exception 'full name required' using errcode = '22023'; end if;
  select * into v_w from public.ws_workshops where upper(code) = upper(btrim(p_code)) and status = 'live';
  if not found then raise exception 'workshop not found or not live' using errcode = 'P0002'; end if;
  select * into v_g from public.ws_groups
   where id = p_group and workshop_id = v_w.id and sc_class_id is not null for update;
  if not found then raise exception 'group not in this workshop' using errcode = '22023'; end if;

  select * into v_p from public.ws_participants where workshop_id = v_w.id and user_id = v_uid;
  if found and v_p.status = 'withdrawn' then
    raise exception 'withdrawn from this workshop; ask your instructor' using errcode = '42501';
  end if;
  if found and v_p.group_id is not null and v_p.group_id <> v_g.id then
    -- already joined: only an instructor moves students between groups
    raise exception 'already in another group; ask your instructor to move you' using errcode = '23505';
  end if;
  if not (found and v_p.group_id = v_g.id and v_p.status = 'active') and v_g.capacity is not null then
    select count(*) into v_members from public.ws_participants where group_id = v_g.id and status = 'active';
    if v_members >= v_g.capacity then raise exception 'group is full' using errcode = 'P0006'; end if;
  end if;

  if found then
    update public.ws_participants set group_id = v_g.id, status = 'active',
           full_name = case when source = 'signup' then v_name else full_name end,
           joined_at = coalesce(joined_at, now())
     where id = v_p.id returning * into v_p;
  else
    insert into public.ws_participants (workshop_id, group_id, user_id, full_name, source, status, joined_at)
    values (v_w.id, v_g.id, v_uid, v_name, 'signup', 'active', now()) returning * into v_p;
  end if;

  perform public.ws_internal_set_user_team(v_uid, v_g.team_name);
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_w.id, 'participant.joined', 'ws_participants', v_p.id,
          jsonb_build_object('group', v_g.number, 'team_name', v_g.team_name));
  return jsonb_build_object('workshop_id', v_w.id, 'participant_id', v_p.id, 'group_id', v_g.id, 'team_name', v_g.team_name);
end $$;
revoke all on function public.ws_join_group(text, uuid, text) from public, anon;
grant execute on function public.ws_join_group(text, uuid, text) to authenticated;

-- ── 10. random join code by default (no ambiguous characters) ─────────────────────────────────
create or replace function public.ws_random_code()
returns text language sql volatile set search_path = public, pg_temp as $$
  select (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
            from generate_series(1, 4))
      || '-' ||
         (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
            from generate_series(1, 4));
$$;
alter table public.ws_workshops alter column code set default public.ws_random_code();

-- ── 11. certificate verify: revoked says only that ────────────────────────────────────────────
create or replace function public.ws_verify_certificate(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_code !~ '^[0-9a-f]{32}$' then null else (
    select case when c.status <> 'issued' then jsonb_build_object('valid', false, 'status', c.status)
           else jsonb_build_object('valid', true, 'certificate_no', c.certificate_no,
             'recipient', split_part(c.recipient_name, ' ', 1)
                          || coalesce(' ' || left(nullif(split_part(c.recipient_name, ' ', 2), ''), 1) || '.', ''),
             'workshop', c.data->>'workshop_title', 'organization', c.data->>'organization', 'issued_at', c.issued_at) end
    from public.ws_certificates c where c.verify_code = p_code) end;
$$;

-- ── 12. groups and problems: staff only (students get their own through ws_my_context) ────────
drop policy if exists ws_grp_sel on public.ws_groups;
create policy ws_grp_sel on public.ws_groups for select to authenticated using (public.ws_is_workshop_staff(workshop_id));
drop policy if exists ws_prob_sel on public.ws_problems;
create policy ws_prob_sel on public.ws_problems for select to authenticated using (public.ws_is_workshop_staff(workshop_id));

-- ── 13. purge a finished workshop's media (photos, job rows); returns storage paths to remove ──
create or replace function public.ws_purge_workshop_media(p_workshop uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_frames jsonb; v_zips jsonb; v_n int;
begin
  if not public.ws_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_w from public.ws_workshops where id = p_workshop;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  if v_w.status not in ('completed', 'archived', 'cancelled') then
    raise exception 'workshop must be completed, archived or cancelled' using errcode = '22023';
  end if;
  with teams as (
    select g.team_name as t from public.ws_groups g where g.workshop_id = p_workshop
    union all
    select 'אישי · ' || g.team_name from public.ws_groups g where g.workshop_id = p_workshop
  ), del as (
    delete from public.sc_detections d where d.team_name in (select t from teams)
    returning d.frame_path, d.crop_path, d.verify_photo_path
  )
  select coalesce(jsonb_agg(p), '[]'::jsonb), count(*) into v_frames, v_n
    from (select unnest(array[frame_path, crop_path, verify_photo_path]) as p from del) x where p is not null;
  with teams as (
    select g.team_name as t from public.ws_groups g where g.workshop_id = p_workshop
    union all
    select 'אישי · ' || g.team_name from public.ws_groups g where g.workshop_id = p_workshop
  ), delj as (
    delete from public.sc_training_jobs j where j.team_name in (select t from teams) returning j.pool_zip_path
  )
  select coalesce(jsonb_agg(pool_zip_path), '[]'::jsonb) into v_zips from delj where pool_zip_path is not null;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'workshop.media_purged', 'ws_workshops', p_workshop,
          jsonb_build_object('frames', jsonb_array_length(v_frames), 'zips', jsonb_array_length(v_zips)));
  return jsonb_build_object('frames', v_frames, 'zips', v_zips, 'photos_deleted', v_n);
end $$;
revoke all on function public.ws_purge_workshop_media(uuid) from public, anon;
grant execute on function public.ws_purge_workshop_media(uuid) to authenticated;

-- ── 14. (applied separately as ws_0011b_restore_transition) Smart City's owner guard reverts every
-- status change except -> 'rejected'; the undo needs 'rejected' -> 'dataset' on the definer path.
create or replace function public.sc_guard_owner_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_thinkcv_admin() then return new; end if;
  new.credits := old.credits;
  new.confidence := old.confidence;
  new.detected_by := old.detected_by;
  new.lat := old.lat; new.lng := old.lng;
  if new.status is distinct from old.status
     and not (old.status = new.status)
     and new.status <> 'rejected'
     and not (old.status = 'awaiting_verify' and new.status = 'verifying')
     and not (old.status = 'rejected' and new.status = 'dataset' and auth.uid() is null) then
    new.status := old.status;
  end if;
  return new;
end $$;

-- advisor: trigger functions must not be callable through the API
revoke all on function public.ws_templates_gate_guard() from public, anon, authenticated;
