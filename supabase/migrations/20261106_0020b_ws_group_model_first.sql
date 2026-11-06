-- 20261106_0020b_ws_group_model_first — the group card shows the group's merged model before any personal one.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.ws_internal_group_stats(uuid, uuid)'::regprocedure) into v_def;
  v_def := replace(v_def, 'order by g.id, m.approved desc, m.created_at desc',
                          'order by g.id, m.approved desc, (m.scope = ''group'') desc, m.created_at desc');
  if v_def not like '%(m.scope = ''group'') desc%' then raise exception 'pattern not found'; end if;
  execute v_def;
end $$;
