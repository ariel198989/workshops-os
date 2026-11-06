-- 20261106_0018_ws_leave_smart_city — remove what workshops left inside Smart City.
-- Run only after 0017 is live, both apps are deployed on the ws_* tables and the pilot's files sit in ws-media.
-- After this migration no Smart City object references a workshops object, and the other way round.

-- 1. Smart City insert policies no longer call a workshops function (the caller-owns-the-row rule stays)
drop policy if exists sc_detections_ins on public.sc_detections;
create policy sc_detections_ins on public.sc_detections for insert to public
  with check (auth.uid() is not null and detected_by = auth.uid() and status in ('pending', 'dataset'));
drop policy if exists sc_jobs_ins on public.sc_training_jobs;
create policy sc_jobs_ins on public.sc_training_jobs for insert to authenticated
  with check (requested_by = auth.uid());
drop policy if exists sc_models_ins on public.sc_models;
create policy sc_models_ins on public.sc_models for insert to authenticated
  with check (owner = auth.uid());
drop function if exists public.ws_team_writable(text);
drop function if exists public.ws_internal_tag_apply(uuid, jsonb, text, boolean, boolean);

-- 2. Smart City's owner-update guard goes back to its own rule (0011b had added an undo path for workshops)
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
     and not (old.status = 'awaiting_verify' and new.status = 'verifying') then
    new.status := old.status;
  end if;
  return new;
end $$;

-- 3. workshop rows leave the Smart City tables (only rows whose copy already points at ws-media)
delete from public.sc_detections d using public.ws_photos p
 where p.id = d.id and p.frame_path like 'w/%';
delete from public.sc_classes c using public.ws_groups g
 where g.sc_class_id = c.id and c.name = g.team_name;

-- 4. the link columns go
alter table public.ws_groups drop column if exists sc_class_id;
alter table public.ws_workshops drop column if exists sc_campaign_id;
