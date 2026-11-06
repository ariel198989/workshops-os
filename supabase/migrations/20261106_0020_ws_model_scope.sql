-- 20261106_0020_ws_model_scope — a model is either a student's own ('personal') or the group's ('group').
-- ws-register-model v2 sets it: personal when the workshop runs personal pools and the requester is an
-- active member of the group; group otherwise (facilitator merge of all members' photos, or group pools).
update public.ws_models set scope = 'group' where scope not in ('personal', 'group');
alter table public.ws_models alter column scope set default 'group';
alter table public.ws_models add constraint ws_models_scope_chk check (scope in ('personal', 'group'));
