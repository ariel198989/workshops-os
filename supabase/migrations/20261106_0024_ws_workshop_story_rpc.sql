-- 20261106_0024_ws_workshop_story_rpc — review fixes.
-- 1. Openers for every workshop staff member: ws_curriculum_templates is readable only by core staff
--    (ws_tpl_sel), so assistants/observers assigned to a workshop got no opener. This RPC returns the
--    workshop template's story to anyone ws_is_workshop_staff allows.
-- 2. ws_internal_my_stats counts only the student's personal models (group models also carry
--    owner = requester, e.g. in a group-pool workshop).
create or replace function public.ws_workshop_story(p_workshop uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select t.story
    from public.ws_workshops w
    join public.ws_curriculum_templates t on t.id = w.template_id
   where w.id = p_workshop and public.ws_is_workshop_staff(p_workshop);
$$;
revoke all on function public.ws_workshop_story(uuid) from public, anon;
grant execute on function public.ws_workshop_story(uuid) to authenticated;

do $$
declare v_def text;
begin
  select pg_get_functiondef('public.ws_internal_my_stats(uuid, text)'::regprocedure) into v_def;
  v_def := replace(v_def, 'where m.owner = p_user and m.approved and m.team_name = p_team',
                          'where m.owner = p_user and m.approved and m.team_name = p_team and m.scope = ''personal''');
  if v_def not like '%m.scope = ''personal''%' then raise exception 'pattern not found'; end if;
  execute v_def;
end $$;
