-- 20261101_0016_ws_pool_scope — each student works on their own photos, tags, training and model
-- ('personal', the default). 'group' pools the whole group. The facilitator merges later.
-- Applied 2026-11-01 as ws_0016_pool_scope_personal (full ws_my_context body in the Supabase history).
alter table public.ws_workshops add column if not exists pool_scope text not null default 'personal';
alter table public.ws_workshops drop constraint if exists ws_workshops_pool_scope_check;
alter table public.ws_workshops add constraint ws_workshops_pool_scope_check check (pool_scope in ('personal', 'group'));
grant update (pool_scope) on public.ws_workshops to authenticated;

create or replace function public.ws_internal_my_stats(p_user uuid, p_team text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'photos', (select count(*) from public.sc_detections d
                where d.detected_by = p_user and d.team_name in (p_team, 'אישי · ' || p_team)
                  and d.frame_path is not null and d.status <> 'rejected'),
    'tagged', (select count(*) from public.sc_detections d
                where d.detected_by = p_user and d.team_name in (p_team, 'אישי · ' || p_team)
                  and d.bbox is not null and d.status <> 'rejected'),
    'models', (select count(*) from public.sc_models m where m.owner = p_user and m.approved
                and m.team_name in (p_team, 'אישי · ' || p_team)),
    'active_job', (select j.status from public.sc_training_jobs j
                    where j.requested_by = p_user and j.team_name in (p_team, 'אישי · ' || p_team)
                      and j.status in ('pending', 'running') order by j.created_at desc limit 1));
$$;
revoke all on function public.ws_internal_my_stats(uuid, text) from public, anon, authenticated;
-- ws_my_context now returns workshop.short_code, workshop.pool_scope, me.user_id and 'mine' = ws_internal_my_stats(...)
