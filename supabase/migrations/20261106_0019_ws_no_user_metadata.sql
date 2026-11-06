-- 20261106_0019_ws_no_user_metadata — workshops stop reading and writing auth user metadata.
-- Closes H2: ws_reconcile_participants added any account whose self-editable user_metadata.class_name
-- matched a group's team_name. Membership now comes only from ws_participants (ws_join_group,
-- device login, staff link/move). The class_name metadata was Smart City's convention; after the
-- separation workshops do not write it either.
-- Also adds ws_participant_private(p_workshop): staff-only read of notes + custom_fields, so 0019b
-- can hide those two columns from the student's own row (M3).

-- 1. reconcile becomes a safe no-op (kept for console compatibility; the console stops calling it)
create or replace function public.ws_reconcile_participants(p_workshop uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object('added', 0, 'drift', '[]'::jsonb);
end $$;

-- 2. join / link / move no longer write user metadata
do $$
declare r record; v_def text;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('ws_join_group', 'ws_link_participant', 'ws_move_participant')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(v_def,
      E'\\n\\s*if v_p\\.user_id is not null and p_group is not null\\s*\\n\\s*and exists \\(select 1 from public\\.ws_groups where id = p_group and activated_at is not null\\) then\\s*\\n\\s*perform public\\.ws_internal_set_user_team\\(v_p\\.user_id, v_new\\);\\s*\\n\\s*end if;',
      '', 'g');
    v_def := regexp_replace(v_def,
      E'\\n\\s*select team_name into v_team from public\\.ws_groups where id = v_p\\.group_id and activated_at is not null;\\s*\\n\\s*if v_team is not null then perform public\\.ws_internal_set_user_team\\(p_user, v_team\\); end if;',
      '', 'g');
    v_def := regexp_replace(v_def,
      E'\\n\\s*perform public\\.ws_internal_set_user_team\\(v_uid, v_g\\.team_name\\);', '', 'g');
    if v_def ilike '%ws_internal_set_user_team%' then
      raise exception '% still calls ws_internal_set_user_team', r.proname;
    end if;
    execute v_def;
  end loop;
end $$;

drop function if exists public.ws_internal_set_user_team(uuid, text);

-- 3. staff-only private columns
create or replace function public.ws_participant_private(p_workshop uuid)
returns table (id uuid, notes text, custom_fields jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.notes, p.custom_fields
    from public.ws_participants p
   where p.workshop_id = p_workshop and public.ws_is_workshop_staff(p_workshop);
$$;
revoke all on function public.ws_participant_private(uuid) from public, anon;
grant execute on function public.ws_participant_private(uuid) to authenticated;
