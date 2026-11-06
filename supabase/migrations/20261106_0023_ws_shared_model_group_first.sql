-- 20261106_0023_ws_shared_model_group_first — the take-home page shows the deliverable model, then the
-- group's merged model, then the newest one.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.ws_shared_model(text)'::regprocedure) into v_def;
  v_def := replace(v_def, E'desc nulls last,\n                  m.created_at desc',
                          E'desc nulls last,\n                  (m.scope = ''group'') desc, m.created_at desc');
  if v_def not like '%(m.scope = ''group'') desc%' then raise exception 'pattern not found'; end if;
  execute v_def;
end $$;
