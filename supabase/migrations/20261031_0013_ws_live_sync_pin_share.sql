-- 20261031_0013_ws_live_sync_pin_share — wave 2 of the 31/10/2026 audit, approved by Ariel.
-- Applied 2026-10-31 as ws_0013_live_sync_pin_share.
--
-- 1 ws_live_state: the facilitator's "now we are doing X" per workshop. Students may SELECT their
--   own workshop's row; it is in the realtime publication; writes only through ws_set_live_step.
-- 2 ws_groups.pin (4 digits) for tablet sign-in without email, generated on insert and backfilled.
--   Students cannot read ws_groups (0011), so the PIN is visible to staff only.
-- 3 ws_groups.share_token for the take-home page: anon RPC ws_shared_model(p_token) returns the
--   group's model (newest approved for the team, or the locked deliverable) plus display labels.
-- 4 ws_my_context carries 'live' so a late joiner lands on the right step without waiting for an event.

-- ── 1. live state ───────────────────────────────────────────────────────────────────────────
create table if not exists public.ws_live_state (
  workshop_id uuid primary key references public.ws_workshops(id) on delete cascade,
  session_id uuid references public.ws_sessions(id) on delete set null,
  session_module_id uuid references public.ws_session_modules(id) on delete set null,
  step_key text,
  label text,
  allowed_routes text[] not null default '{}',
  message text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.ws_live_state enable row level security;
alter table public.ws_live_state replica identity full;
revoke all on public.ws_live_state from public, anon;
grant select on public.ws_live_state to authenticated;
drop policy if exists ws_live_sel on public.ws_live_state;
create policy ws_live_sel on public.ws_live_state for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or workshop_id in (select public.ws_my_workshop_ids()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'public' and tablename = 'ws_live_state') then
    alter publication supabase_realtime add table public.ws_live_state;
  end if;
end $$;

create or replace function public.ws_set_live_step(
  p_workshop uuid, p_session_module uuid default null, p_step_key text default null, p_label text default null,
  p_allowed_routes text[] default null, p_message text default null)
returns public.ws_live_state language plpgsql security definer set search_path = public, pg_temp as $$
declare v_sid uuid; v_row public.ws_live_state;
begin
  if not public.ws_is_workshop_staff(p_workshop) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_session_module is not null then
    select session_id into v_sid from public.ws_session_modules where id = p_session_module and workshop_id = p_workshop;
    if v_sid is null then raise exception 'module not in this workshop' using errcode = '22023'; end if;
  end if;
  if p_allowed_routes is not null and not (p_allowed_routes <@ array['capture','tag','train','results','check','certificate']) then
    raise exception 'unknown route' using errcode = '22023';
  end if;
  insert into public.ws_live_state (workshop_id, session_id, session_module_id, step_key, label, allowed_routes, message, updated_by, updated_at)
  values (p_workshop, v_sid, p_session_module, left(p_step_key, 40), left(p_label, 120),
          coalesce(p_allowed_routes, '{}'), left(p_message, 200), auth.uid(), now())
  on conflict (workshop_id) do update
     set session_id = excluded.session_id, session_module_id = excluded.session_module_id,
         step_key = excluded.step_key, label = excluded.label, allowed_routes = excluded.allowed_routes,
         message = excluded.message, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.ws_set_live_step(uuid, uuid, text, text, text[], text) from public, anon;
grant execute on function public.ws_set_live_step(uuid, uuid, text, text, text[], text) to authenticated;

create or replace function public.ws_clear_live_step(p_workshop uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ws_is_workshop_staff(p_workshop) then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.ws_live_state where workshop_id = p_workshop;
end $$;
revoke all on function public.ws_clear_live_step(uuid) from public, anon;
grant execute on function public.ws_clear_live_step(uuid) to authenticated;

-- ── 2. group PIN + 3. share token ──────────────────────────────────────────────────────────
alter table public.ws_groups
  add column if not exists pin text,
  add column if not exists share_token text,
  add column if not exists device_user_id uuid;
create unique index if not exists ws_groups_share_token_key on public.ws_groups (share_token);

create or replace function public.ws_random_pin()
returns text language sql volatile set search_path = public, pg_temp as $$
  select lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
$$;
create or replace function public.ws_random_token(p_len int default 12)
returns text language sql volatile set search_path = public, pg_temp as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, greatest(6, p_len));
$$;

create or replace function public.ws_groups_secrets_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.pin is null then new.pin := public.ws_random_pin(); end if;
  if new.share_token is null then new.share_token := public.ws_random_token(12); end if;
  return new;
end $$;
drop trigger if exists ws_groups_secrets_defaults on public.ws_groups;
create trigger ws_groups_secrets_defaults before insert on public.ws_groups
  for each row execute function public.ws_groups_secrets_defaults();
revoke all on function public.ws_groups_secrets_defaults() from public, anon, authenticated;

update public.ws_groups set pin = public.ws_random_pin() where pin is null;
update public.ws_groups set share_token = public.ws_random_token(12) where share_token is null;

-- staff may rotate a PIN; pin / share_token / device_user_id are never writable by clients directly
revoke update (pin, share_token, device_user_id) on public.ws_groups from authenticated;
create or replace function public.ws_rotate_group_pin(p_group uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid; v_pin text;
begin
  select workshop_id into v_wid from public.ws_groups where id = p_group;
  if v_wid is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_wid) then raise exception 'not authorized' using errcode = '42501'; end if;
  v_pin := public.ws_random_pin();
  update public.ws_groups set pin = v_pin where id = p_group;
  return v_pin;
end $$;
revoke all on function public.ws_rotate_group_pin(uuid) from public, anon;
grant execute on function public.ws_rotate_group_pin(uuid) to authenticated;

-- device sign-in attempts (edge function ws-device-login writes here with the service role)
create table if not exists public.ws_device_login_attempts (
  id bigserial primary key,
  group_id uuid not null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ws_device_login_attempts_grp on public.ws_device_login_attempts (group_id, created_at);
alter table public.ws_device_login_attempts enable row level security;
revoke all on public.ws_device_login_attempts from public, anon, authenticated;


-- service-role helper for the device login function (no PostgREST access to auth.users)
create or replace function public.ws_internal_user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.ws_internal_user_id_by_email(text) from public, anon, authenticated;

-- ── 3. take-home page: anon RPC by share token ──────────────────────────────────────────────
create or replace function public.ws_shared_model(p_token text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_token !~ '^[a-z2-9]{6,24}$' then null else (
    select jsonb_build_object(
      'workshop', w.title,
      'organization', o.name,
      'group', coalesce(g.display_name, 'קבוצה ' || g.number),
      'status', w.status,
      'model', (
        select jsonb_build_object('id', m.id, 'zip_path', m.zip_path, 'classes', m.classes,
                                  'class_stats', m.class_stats, 'accuracy', m.accuracy,
                                  'image_count', m.image_count, 'created_at', m.created_at)
          from public.sc_models m
         where m.approved
           and (m.id = (select d.model_id from public.ws_deliverables d where d.group_id = g.id and d.model_id is not null limit 1)
                or m.team_name in (g.team_name, 'אישי · ' || g.team_name))
         order by (m.id = (select d.model_id from public.ws_deliverables d where d.group_id = g.id limit 1)) desc,
                  m.created_at desc
         limit 1))
    from public.ws_groups g
    join public.ws_workshops w on w.id = g.workshop_id
    join public.ws_organizations o on o.id = w.organization_id
    where g.share_token = p_token and w.status in ('live', 'completed')) end;
$$;
revoke all on function public.ws_shared_model(text) from public;
grant execute on function public.ws_shared_model(text) to anon, authenticated;

-- ── 4. live state inside ws_my_context ──────────────────────────────────────────────────────
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
                'team_name', g.team_name, 'share_token', g.share_token) from public.ws_groups g where g.id = v_p.group_id),
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
    'live', (select jsonb_build_object('session_module_id', l.session_module_id, 'step_key', l.step_key,
                      'label', l.label, 'allowed_routes', to_jsonb(l.allowed_routes), 'message', l.message,
                      'updated_at', l.updated_at)
             from public.ws_live_state l where l.workshop_id = v_p.workshop_id),
    'progress', case when v_p.group_id is null then null
                     else public.ws_internal_group_stats(v_p.workshop_id, v_p.group_id) -> 0 end,
    'certificate', (select jsonb_build_object('certificate_no', c.certificate_no, 'issued_at', c.issued_at,
                      'pdf_path', c.pdf_path, 'status', c.status)
                    from public.ws_certificates c where c.participant_id = v_p.id));
end $$;
