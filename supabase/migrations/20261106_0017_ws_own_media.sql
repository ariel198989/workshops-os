-- 20261106_0017_ws_own_media — workshops stop living inside Smart City.
-- Until now the student app wrote photos, training jobs and models into Smart City's sc_detections /
-- sc_training_jobs / sc_models, stored files in the PUBLIC bucket 'smartcity', and every activated group
-- got a row in sc_classes. This migration gives workshops their own tables, a private media bucket and a
-- models bucket, and re-points every ws_* function at them. Smart City objects are not changed here;
-- 0018 removes the leftovers once both apps are deployed.
-- Applied 2026-11-06 as ws_0017_own_media.

-- ---------------------------------------------------------------- helpers
create or replace function public.ws_media_writable(p_group uuid, p_workshop uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_group is not null and p_workshop is not null and (
    exists (select 1 from public.ws_participants p join public.ws_workshops w on w.id = p.workshop_id
             where p.user_id = auth.uid() and p.status = 'active'
               and p.group_id = p_group and p.workshop_id = p_workshop and w.status = 'live')
    or (public.ws_is_workshop_staff(p_workshop)
        and exists (select 1 from public.ws_groups g where g.id = p_group and g.workshop_id = p_workshop)));
$$;
revoke all on function public.ws_media_writable(uuid, uuid) from public, anon;
grant execute on function public.ws_media_writable(uuid, uuid) to authenticated;

-- the client may send only team_name (as it always did); the group and workshop are resolved here
create or replace function public.ws_media_fill()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_gid uuid; v_wid uuid; v_team text;
begin
  select g.id, g.workshop_id, g.team_name into v_gid, v_wid, v_team
    from public.ws_groups g
   where case when new.group_id is not null then g.id = new.group_id else g.team_name = new.team_name end;
  if v_gid is null then raise exception 'group not found' using errcode = '23503'; end if;
  new.group_id := v_gid; new.workshop_id := v_wid; new.team_name := v_team;
  return new;
end $$;
revoke all on function public.ws_media_fill() from public, anon, authenticated;

-- ---------------------------------------------------------------- tables
create table if not exists public.ws_photos (
  id          uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  group_id    uuid not null,
  team_name   text not null,
  class_name  text not null check (char_length(class_name) between 1 and 40 and class_name !~ '[''"\n\r]'),
  frame_path  text not null unique,
  bbox        jsonb,
  status      text not null default 'dataset' check (status in ('dataset', 'rejected')),
  detected_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (group_id, workshop_id) references public.ws_groups (id, workshop_id) on delete cascade
);
create index if not exists ws_photos_group_idx on public.ws_photos (group_id, created_at desc);
create index if not exists ws_photos_user_idx on public.ws_photos (detected_by);
create index if not exists ws_photos_workshop_idx on public.ws_photos (workshop_id);

create table if not exists public.ws_training_jobs (
  id              uuid primary key default gen_random_uuid(),
  workshop_id     uuid not null,
  group_id        uuid not null,
  team_name       text not null,
  status          text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  pool_zip_path   text,
  image_count     integer not null default 0,
  classes         jsonb not null default '[]'::jsonb,
  requested_by    uuid references auth.users (id) on delete set null,
  result_model_id uuid,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  failure_reason  text,
  foreign key (group_id, workshop_id) references public.ws_groups (id, workshop_id) on delete cascade
);
create index if not exists ws_training_jobs_group_idx on public.ws_training_jobs (group_id, created_at desc);
create index if not exists ws_training_jobs_open_idx on public.ws_training_jobs (created_at) where status in ('pending', 'running');
create index if not exists ws_training_jobs_workshop_idx on public.ws_training_jobs (workshop_id);
create index if not exists ws_training_jobs_user_idx on public.ws_training_jobs (requested_by);

create table if not exists public.ws_models (
  id          uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  group_id    uuid not null,
  team_name   text not null,
  owner       uuid references auth.users (id) on delete set null,
  name        text not null,
  classes     jsonb not null default '[]'::jsonb,
  zip_path    text not null,
  approved    boolean not null default true,
  accuracy    numeric,
  image_count integer,
  honest_val  boolean,
  scope       text not null default 'team',
  class_stats jsonb,
  created_at  timestamptz not null default now(),
  foreign key (group_id, workshop_id) references public.ws_groups (id, workshop_id) on delete cascade
);
create index if not exists ws_models_group_idx on public.ws_models (group_id, created_at desc);
create index if not exists ws_models_workshop_idx on public.ws_models (workshop_id);
create index if not exists ws_models_owner_idx on public.ws_models (owner);

drop trigger if exists ws_photos_fill on public.ws_photos;
create trigger ws_photos_fill before insert on public.ws_photos for each row execute function public.ws_media_fill();
drop trigger if exists ws_training_jobs_fill on public.ws_training_jobs;
create trigger ws_training_jobs_fill before insert on public.ws_training_jobs for each row execute function public.ws_media_fill();
drop trigger if exists ws_models_fill on public.ws_models;
create trigger ws_models_fill before insert on public.ws_models for each row execute function public.ws_media_fill();

-- ---------------------------------------------------------------- RLS and grants
alter table public.ws_photos enable row level security;
alter table public.ws_training_jobs enable row level security;
alter table public.ws_models enable row level security;

revoke all on public.ws_photos, public.ws_training_jobs, public.ws_models from anon, authenticated;
grant select on public.ws_photos, public.ws_training_jobs, public.ws_models to authenticated;
grant insert (team_name, group_id, class_name, frame_path, detected_by, status) on public.ws_photos to authenticated;
grant insert (team_name, group_id, pool_zip_path, image_count, classes, requested_by) on public.ws_training_jobs to authenticated;
grant update (status) on public.ws_training_jobs to authenticated;

drop policy if exists ws_photos_sel on public.ws_photos;
create policy ws_photos_sel on public.ws_photos for select to authenticated
  using (group_id in (select public.ws_my_group_ids()) or public.ws_is_workshop_staff(workshop_id));
drop policy if exists ws_photos_ins on public.ws_photos;
create policy ws_photos_ins on public.ws_photos for insert to authenticated
  with check (detected_by = (select auth.uid()) and status = 'dataset' and bbox is null
              and public.ws_media_writable(group_id, workshop_id)
              and frame_path like 'w/' || workshop_id || '/g/' || group_id || '/p/%');

drop policy if exists ws_training_jobs_sel on public.ws_training_jobs;
create policy ws_training_jobs_sel on public.ws_training_jobs for select to authenticated
  using (group_id in (select public.ws_my_group_ids()) or public.ws_is_workshop_staff(workshop_id));
drop policy if exists ws_training_jobs_ins on public.ws_training_jobs;
create policy ws_training_jobs_ins on public.ws_training_jobs for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending' and image_count between 1 and 5000
              and public.ws_media_writable(group_id, workshop_id)
              and pool_zip_path like 'w/' || workshop_id || '/g/' || group_id || '/jobs/%');
-- the requester may only cancel a job that is still open; staff fail one through ws_fail_training_job
drop policy if exists ws_training_jobs_cancel on public.ws_training_jobs;
create policy ws_training_jobs_cancel on public.ws_training_jobs for update to authenticated
  using (requested_by = (select auth.uid()) and status in ('pending', 'running'))
  with check (requested_by = (select auth.uid()) and status = 'cancelled');

drop policy if exists ws_models_sel on public.ws_models;
create policy ws_models_sel on public.ws_models for select to authenticated
  using (group_id in (select public.ws_my_group_ids()) or public.ws_is_workshop_staff(workshop_id));
-- models are written only by the trainer (service role, edge function ws-register-model)

-- ---------------------------------------------------------------- storage
-- ws-media: PRIVATE. Photos at w/{workshop}/g/{group}/p/*.jpg, dataset ZIPs at w/{workshop}/g/{group}/jobs/*.zip
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ws-media', 'ws-media', false, null, array['image/jpeg', 'application/zip'])
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types;
-- ws-models: trained model ZIPs at {group}/m_*.zip. Public by URL only (no list policy) so the take-home
-- page can load a model without an account; the path is unguessable and holds no personal data.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ws-models', 'ws-models', true, null, array['application/zip'])
on conflict (id) do update set public = true, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ws_media_read on storage.objects;
create policy ws_media_read on storage.objects for select to authenticated
  using (bucket_id = 'ws-media'
         and (public.ws_try_uuid((storage.foldername(name))[4]) in (select public.ws_my_group_ids())
              or public.ws_is_workshop_staff(public.ws_try_uuid((storage.foldername(name))[2]))));
drop policy if exists ws_media_upload on storage.objects;
create policy ws_media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ws-media'
              and (storage.foldername(name))[1] = 'w' and (storage.foldername(name))[3] = 'g'
              and (storage.foldername(name))[5] in ('p', 'jobs')
              and public.ws_media_writable(public.ws_try_uuid((storage.foldername(name))[4]),
                                           public.ws_try_uuid((storage.foldername(name))[2])));
drop policy if exists ws_media_staff_delete on storage.objects;
create policy ws_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ws-media' and public.ws_can_edit_workshop(public.ws_try_uuid((storage.foldername(name))[2])));
drop policy if exists ws_models_admin_read on storage.objects;
create policy ws_models_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'ws-models' and public.ws_is_admin());
drop policy if exists ws_models_admin_delete on storage.objects;
create policy ws_models_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ws-models' and public.ws_is_admin());

-- ---------------------------------------------------------------- student RPCs
-- everyone's open jobs (id, status, time only): the trainer is one queue for all workshop groups
create or replace function public.ws_training_queue()
returns table (id uuid, status text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select j.id, j.status, j.created_at from public.ws_training_jobs j
   where j.status in ('pending', 'running') and auth.uid() is not null
   order by j.created_at limit 200;
$$;
revoke all on function public.ws_training_queue() from public, anon;
grant execute on function public.ws_training_queue() to authenticated;

create or replace function public.ws_tag_detection(p_id uuid, p_bbox jsonb, p_class text, p_reject boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p public.ws_photos; v_class text := nullif(btrim(coalesce(p_class, '')), ''); v_box jsonb;
        v_wstatus text; v_depth text; v_device text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_p from public.ws_photos where id = p_id for update;
  if not found then raise exception 'photo not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.ws_participants p
                  where p.user_id = auth.uid() and p.status = 'active' and p.group_id = v_p.group_id) then
    raise exception 'photo is not from your group' using errcode = '42501';
  end if;
  select status, cycle_depth, device_mode into v_wstatus, v_depth, v_device
    from public.ws_workshops where id = v_p.workshop_id;
  if v_wstatus <> 'live' then raise exception 'workshop not live' using errcode = '42501'; end if;
  if not coalesce((public.ws_student_caps(v_depth, v_device) ->> 'can_tag')::boolean, false) then
    raise exception 'tagging is not enabled for this workshop' using errcode = '42501';
  end if;

  -- no box, no class, no reject = undo of a delete
  if not p_reject and p_bbox is null and v_class is null then
    if v_p.status <> 'rejected' then raise exception 'photo already handled' using errcode = 'P0002'; end if;
    update public.ws_photos set status = 'dataset' where id = p_id;
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (v_p.workshop_id, 'photo.restored', 'ws_photos', p_id, jsonb_build_object('team', v_p.team_name));
    return;
  end if;
  if v_p.status <> 'dataset' then raise exception 'photo already handled' using errcode = 'P0002'; end if;

  if p_reject then
    update public.ws_photos set status = 'rejected' where id = p_id;
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (v_p.workshop_id, 'photo.rejected', 'ws_photos', p_id, jsonb_build_object('team', v_p.team_name));
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
  update public.ws_photos set bbox = v_box, class_name = coalesce(v_class, class_name) where id = p_id;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_p.workshop_id, 'photo.tagged', 'ws_photos', p_id, jsonb_build_object('team', v_p.team_name, 'class', v_class));
end $$;

create or replace function public.ws_internal_my_stats(p_user uuid, p_team text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'photos', (select count(*) from public.ws_photos d
                where d.detected_by = p_user and d.team_name = p_team and d.status <> 'rejected'),
    'tagged', (select count(*) from public.ws_photos d
                where d.detected_by = p_user and d.team_name = p_team
                  and d.bbox is not null and d.status <> 'rejected'),
    'models', (select count(*) from public.ws_models m
                where m.owner = p_user and m.approved and m.team_name = p_team),
    'active_job', (select j.status from public.ws_training_jobs j
                    where j.requested_by = p_user and j.team_name = p_team
                      and j.status in ('pending', 'running') order by j.created_at desc limit 1));
$$;
revoke all on function public.ws_internal_my_stats(uuid, text) from public, anon, authenticated;

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
          from public.ws_models m
         where m.approved and m.group_id = g.id
         order by (m.id = (select d.model_id from public.ws_deliverables d where d.group_id = g.id limit 1)) desc nulls last,
                  m.created_at desc
         limit 1))
    from public.ws_groups g
    join public.ws_workshops w on w.id = g.workshop_id
    join public.ws_organizations o on o.id = w.organization_id
    where g.share_token = p_token and w.status in ('live', 'completed')) end;
$$;

-- ---------------------------------------------------------------- staff RPCs
create or replace function public.ws_fail_training_job(p_job uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select workshop_id, status into v_wid, v_status from public.ws_training_jobs where id = p_job;
  if v_wid is null then raise exception 'job not found' using errcode = 'P0002'; end if;
  if not (public.ws_is_core_staff() or public.ws_is_workshop_staff(v_wid)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'running') then raise exception 'job is not active' using errcode = '22023'; end if;
  update public.ws_training_jobs
     set status = 'failed', failure_reason = left(coalesce(p_reason, ''), 200), completed_at = now()
   where id = p_job;
end $$;

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
  with del as (delete from public.ws_photos d where d.workshop_id = p_workshop returning d.frame_path)
  select coalesce(jsonb_agg(frame_path), '[]'::jsonb), count(*) into v_frames, v_n from del;
  with delj as (delete from public.ws_training_jobs j where j.workshop_id = p_workshop returning j.pool_zip_path)
  select coalesce(jsonb_agg(pool_zip_path) filter (where pool_zip_path is not null), '[]'::jsonb) into v_zips from delj;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'workshop.media_purged', 'ws_workshops', p_workshop,
          jsonb_build_object('frames', jsonb_array_length(v_frames), 'zips', jsonb_array_length(v_zips)));
  return jsonb_build_object('frames', v_frames, 'zips', v_zips, 'photos_deleted', v_n);
end $$;

create or replace function public.ws_deliverables_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_staff boolean := public.ws_can_edit_workshop(new.workshop_id);
begin
  if tg_op = 'UPDATE' and not v_staff then
    if old.locked_at is not null then
      raise exception 'deliverable is locked' using errcode = '42501';
    end if;
    if (new.model_id, new.training_job_id, new.dataset_snapshot, new.model_snapshot, new.demo_result,
        new.demo_score, new.demo_notes, new.reviewed_by, new.reviewed_at, new.locked_at, new.group_id, new.workshop_id)
       is distinct from
       (old.model_id, old.training_job_id, old.dataset_snapshot, old.model_snapshot, old.demo_result,
        old.demo_score, old.demo_notes, old.reviewed_by, old.reviewed_at, old.locked_at, old.group_id, old.workshop_id) then
      raise exception 'students may only edit presentation, failure cases and submit' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('in_progress', 'returned', 'submitted') and new.status in ('submitted', 'in_progress')) then
      raise exception 'illegal status change % -> %', old.status, new.status using errcode = '42501';
    end if;
    if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now(); end if;
  end if;

  if new.model_id is not null then
    if tg_op = 'INSERT' or new.model_id is distinct from old.model_id then
      perform 1 from public.ws_models m where m.id = new.model_id and m.group_id = new.group_id;
      if not found then
        raise exception 'model % does not belong to this group', new.model_id using errcode = '23514';
      end if;
    end if;
  end if;
  if new.training_job_id is not null then
    if tg_op = 'INSERT' or new.training_job_id is distinct from old.training_job_id then
      perform 1 from public.ws_training_jobs j where j.id = new.training_job_id and j.group_id = new.group_id;
      if not found then raise exception 'training job not found' using errcode = '23503'; end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.ws_lock_deliverable(p_group uuid, p_model uuid default null)
returns public.ws_deliverables language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid; v_stats jsonb; v_model uuid; v_d public.ws_deliverables;
begin
  select workshop_id into v_wid from public.ws_groups where id = p_group;
  if v_wid is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_wid) then raise exception 'not authorized' using errcode = '42501'; end if;

  v_stats := public.ws_internal_group_stats(v_wid, p_group) -> 0;
  v_model := coalesce(p_model,
                      (select model_id from public.ws_deliverables where group_id = p_group),
                      (v_stats #>> '{model,id}')::uuid);

  update public.ws_deliverables d set
      model_id         = v_model,
      dataset_snapshot = jsonb_build_object('photos', v_stats->'photos', 'tagged', v_stats->'tagged',
                           'contributors', v_stats->'contributors', 'coverage', v_stats->'coverage',
                           'off_target_classes', v_stats->'off_target_classes', 'captured_at', now()),
      model_snapshot   = (select jsonb_build_object('id', m.id, 'name', m.name, 'accuracy', m.accuracy,
                           'classes', m.classes, 'class_stats', m.class_stats, 'image_count', m.image_count,
                           'honest_val', m.honest_val, 'approved', m.approved, 'created_at', m.created_at)
                          from public.ws_models m where m.id = v_model),
      locked_at = now(), status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where d.group_id = p_group
  returning * into v_d;
  if not found then raise exception 'deliverable row missing — activate the group first' using errcode = 'P0002'; end if;

  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_wid, 'deliverable.locked', 'ws_deliverables', v_d.id, jsonb_build_object('model_id', v_model));
  return v_d;
end $$;

create or replace function public.ws_internal_group_stats(p_workshop uuid, p_group uuid default null)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
with g as (
  select g.id, g.number, g.display_name, g.team_name, g.status, g.activated_at, g.subproblem_id,
         s.title as sub_title, s.task_type, coalesce(s.target_classes, '{}'::text[]) as target_classes,
         s.target_accuracy
  from public.ws_groups g
  left join public.ws_subproblems s on s.id = g.subproblem_id
  where g.workshop_id = p_workshop and (p_group is null or g.id = p_group)
),
d as (
  select g.id as gid, x.class_name, x.detected_by, x.created_at, (x.bbox is not null) as is_tagged
  from g join public.ws_photos x on x.group_id = g.id
  where x.status <> 'rejected'
),
dstat as (
  select gid,
    count(*)                               as photos,
    count(*) filter (where is_tagged)      as tagged,
    count(*) filter (where not is_tagged)  as untagged,
    count(*) filter (where created_at >=
        (date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem')) as today,
    count(distinct detected_by)            as contributors,
    max(created_at)                        as last_photo_at
  from d group by gid
),
dcls as (
  select gid, lower(btrim(class_name)) as k, min(class_name) as name, count(*) as n
  from d where is_tagged
  group by gid, lower(btrim(class_name))
),
cov as (
  select g.id as gid,
         jsonb_agg(jsonb_build_object('name', t.cls, 'tagged', coalesce(c.n, 0)) order by t.ord) as coverage,
         min(coalesce(c.n, 0)) as min_tagged
  from g
  cross join lateral unnest(g.target_classes) with ordinality as t(cls, ord)
  left join dcls c on c.gid = g.id and c.k = lower(btrim(t.cls))
  group by g.id
),
offt as (
  select c.gid, jsonb_agg(jsonb_build_object('name', c.name, 'tagged', c.n) order by c.n desc) as off_target
  from dcls c join g on g.id = c.gid
  where not exists (select 1 from unnest(g.target_classes) t where lower(btrim(t)) = c.k)
  group by c.gid
),
mem as (
  select group_id as gid,
         count(*) filter (where status = 'active')                         as members,
         count(*) filter (where status = 'active' and user_id is not null) as linked
  from public.ws_participants
  where workshop_id = p_workshop and group_id is not null
  group by group_id
),
jobs as (
  select g.id as gid,
    count(*) filter (where j.status = 'pending') as pending,
    count(*) filter (where j.status = 'running') as running,
    count(*) filter (where j.status = 'done')    as done,
    (array_agg(jsonb_build_object('id', j.id, 'status', j.status, 'image_count', j.image_count,
        'personal', false, 'created_at', j.created_at, 'completed_at', j.completed_at)
      order by j.created_at desc))[1] as last_job
  from g join public.ws_training_jobs j on j.group_id = g.id
  group by g.id
),
mdl as (
  select distinct on (g.id) g.id as gid,
    jsonb_build_object('id', m.id, 'name', m.name, 'accuracy', m.accuracy, 'approved', m.approved,
      'scope', m.scope, 'image_count', m.image_count, 'honest_val', m.honest_val,
      'class_stats', m.class_stats, 'personal', false, 'created_at', m.created_at) as model
  from g join public.ws_models m on m.group_id = g.id
  order by g.id, m.approved desc, m.created_at desc
),
mcnt as (
  select g.id as gid, count(*) as n from g join public.ws_models m on m.group_id = g.id group by g.id
),
att as (
  select p.group_id as gid,
         round(avg(case when a.status in ('present', 'late') then 1.0 else 0.0 end), 3) as rate
  from public.ws_attendance a
  join public.ws_participants p on p.id = a.participant_id
  where a.workshop_id = p_workshop and p.group_id is not null
  group by p.group_id
),
dl as (
  select group_id as gid, status, model_id, presentation_url, demo_result, demo_score, locked_at
  from public.ws_deliverables where workshop_id = p_workshop
)
select coalesce(jsonb_agg(jsonb_build_object(
    'group_id', g.id, 'number', g.number, 'display_name', g.display_name, 'team_name', g.team_name,
    'status', g.status, 'activated', g.activated_at is not null,
    'subproblem', case when g.subproblem_id is null then null else jsonb_build_object(
        'id', g.subproblem_id, 'title', g.sub_title, 'task_type', g.task_type,
        'target_classes', to_jsonb(g.target_classes), 'target_accuracy', g.target_accuracy) end,
    'members', coalesce(mem.members, 0), 'linked_accounts', coalesce(mem.linked, 0),
    'photos', coalesce(ds.photos, 0), 'tagged', coalesce(ds.tagged, 0), 'untagged', coalesce(ds.untagged, 0),
    'today', coalesce(ds.today, 0), 'contributors', coalesce(ds.contributors, 0), 'last_photo_at', ds.last_photo_at,
    'coverage', coalesce(cov.coverage, '[]'::jsonb),
    'off_target_classes', coalesce(offt.off_target, '[]'::jsonb),
    'readiness', case when cov.min_tagged is null then 'no_targets'
                      when cov.min_tagged < 50  then 'red'
                      when cov.min_tagged < 150 then 'ok' else 'strong' end,
    'jobs', jsonb_build_object('pending', coalesce(jobs.pending, 0), 'running', coalesce(jobs.running, 0),
                               'done', coalesce(jobs.done, 0), 'last', jobs.last_job),
    'model', mdl.model, 'models_count', coalesce(mcnt.n, 0),
    'attendance_rate', att.rate,
    'deliverable', case when dl.gid is null then null else jsonb_build_object(
        'status', dl.status, 'final_model_id', dl.model_id, 'presentation_url', dl.presentation_url,
        'demo_result', dl.demo_result, 'demo_score', dl.demo_score, 'locked', dl.locked_at is not null) end
  ) order by g.number), '[]'::jsonb)
from g
left join dstat ds on ds.gid = g.id
left join cov      on cov.gid = g.id
left join offt     on offt.gid = g.id
left join mem      on mem.gid = g.id
left join jobs     on jobs.gid = g.id
left join mdl      on mdl.gid = g.id
left join mcnt     on mcnt.gid = g.id
left join att      on att.gid = g.id
left join dl       on dl.gid = g.id;
$$;

-- ---------------------------------------------------------------- activation without Smart City
-- a group is "activated" when activated_at is set; it no longer gets a row in sc_classes
create or replace function public.ws_activate_groups(p_workshop uuid)
returns setof public.ws_groups language plpgsql security definer set search_path = public, pg_temp as $$
declare v_g record;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ws_workshops where id = p_workshop) then
    raise exception 'workshop not found' using errcode = 'P0002';
  end if;

  for v_g in select * from public.ws_groups
             where workshop_id = p_workshop and activated_at is null
             order by number for update loop
    update public.ws_groups
       set activated_at = now(),
           status = case when status = 'forming' then 'active' else status end
     where id = v_g.id;
    insert into public.ws_deliverables (workshop_id, group_id) values (p_workshop, v_g.id)
      on conflict (group_id) do nothing;
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (p_workshop, 'group.activated', 'ws_groups', v_g.id, jsonb_build_object('team_name', v_g.team_name));
  end loop;

  return query select * from public.ws_groups where workshop_id = p_workshop order by number;
end $$;

create or replace function public.ws_groups_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.workshop_id <> old.workshop_id then
    raise exception 'a group cannot move between workshops' using errcode = '23514';
  end if;
  if old.activated_at is not null and (new.team_name is distinct from old.team_name or new.number <> old.number) then
    raise exception 'team identity is immutable after activation (it keys the group''s photos and models)' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.ws_workshops_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.team_prefix is distinct from old.team_prefix
     and exists (select 1 from public.ws_groups where workshop_id = old.id and activated_at is not null) then
    raise exception 'team_prefix is locked once groups are activated (it keys the groups'' photos and models)'
      using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.ws_set_workshop_status(p_workshop uuid, p_status text)
returns public.ws_workshops language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_from text;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = p_workshop for update;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  v_from := v_w.status;
  if (v_from, p_status) not in (values
      ('draft','proposal'), ('draft','confirmed'), ('draft','cancelled'),
      ('proposal','draft'), ('proposal','confirmed'), ('proposal','cancelled'),
      ('confirmed','proposal'), ('confirmed','live'), ('confirmed','cancelled'),
      ('live','confirmed'), ('live','completed'),
      ('completed','live'), ('completed','archived'),
      ('archived','completed'), ('cancelled','draft')) then
    raise exception 'illegal status transition % -> %', v_from, p_status using errcode = '22023';
  end if;
  if p_status = 'archived' or v_from = 'archived' then
    if not public.ws_is_admin() then raise exception 'only admins archive' using errcode = '42501'; end if;
  end if;

  update public.ws_workshops set status = p_status where id = p_workshop returning * into v_w;

  if p_status = 'live' then
    perform public.ws_activate_groups(p_workshop);
  end if;

  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'workshop.status', 'ws_workshops', p_workshop,
          jsonb_build_object('from', v_from, 'to', p_status));
  return v_w;
end $$;

-- the remaining functions only ask "is this group activated?": same body, new flag
do $$
declare r record; v_def text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in
              ('ws_find_workshop', 'ws_join_group', 'ws_link_participant', 'ws_move_participant', 'ws_reconcile_participants') loop
    v_def := pg_get_functiondef(r.oid);
    if v_def ~ 'sc_class_id' then
      v_def := replace(v_def, 'sc_class_id is not null', 'activated_at is not null');
      if v_def ~ 'sc_class_id' then raise exception 'unexpected sc_class_id use in %', r.proname; end if;
      execute v_def;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- bring the pilot's photos over
-- same ids; frame_path still points at the old public bucket until the files are moved to ws-media
insert into public.ws_photos (id, workshop_id, group_id, team_name, class_name, frame_path, bbox, status, detected_by, created_at)
select d.id, g.workshop_id, g.id, g.team_name, d.class_name, d.frame_path, d.bbox,
       case when d.status = 'rejected' then 'rejected' else 'dataset' end,
       (select u.id from auth.users u where u.id = d.detected_by), d.created_at
  from public.sc_detections d join public.ws_groups g on g.team_name = d.team_name
 where d.frame_path is not null
on conflict do nothing;
