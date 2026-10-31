-- 20261101_0014_ws_group_join_token — one scan joins a tablet: a per-group secret join token used by
-- ws-device-login (v2) instead of code + group + PIN. Staff see it as a QR / link in the console.
-- Applied 2026-11-01 as ws_0014_group_join_token.
alter table public.ws_groups add column if not exists join_token text;
create unique index if not exists ws_groups_join_token_key on public.ws_groups (join_token);

create or replace function public.ws_groups_secrets_defaults()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.pin is null then new.pin := public.ws_random_pin(); end if;
  if new.share_token is null then new.share_token := public.ws_random_token(12); end if;
  if new.join_token is null then new.join_token := public.ws_random_token(20); end if;
  return new;
end $$;
update public.ws_groups set join_token = public.ws_random_token(20) where join_token is null;
revoke update (join_token) on public.ws_groups from authenticated;

create or replace function public.ws_rotate_join_token(p_group uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid; v_tok text;
begin
  select workshop_id into v_wid from public.ws_groups where id = p_group;
  if v_wid is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_wid) then raise exception 'not authorized' using errcode = '42501'; end if;
  v_tok := public.ws_random_token(20);
  update public.ws_groups set join_token = v_tok where id = p_group;
  return v_tok;
end $$;
revoke all on function public.ws_rotate_join_token(uuid) from public, anon;
grant execute on function public.ws_rotate_join_token(uuid) to authenticated;
