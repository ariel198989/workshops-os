-- 20261101_0015_ws_workshop_number — a 4-digit workshop number ("1357") that children type on the first
-- screen. Assigned when a workshop is confirmed or live, unique among open workshops, released when it
-- finishes. ws_find_workshop / ws_join_group accept it too. Applied 2026-11-01 as ws_0015_workshop_number.
-- Full text (including the redefined ws_find_workshop and ws_join_group) is in the Supabase migration
-- history; this file mirrors the schema part.
alter table public.ws_workshops add column if not exists short_code text;
create index if not exists ws_workshops_short_code_idx on public.ws_workshops (short_code) where short_code is not null;
revoke update (short_code) on public.ws_workshops from authenticated;

create or replace function public.ws_free_short_code()
returns text language plpgsql volatile set search_path = public, pg_temp as $$
declare v text; i int := 0;
begin
  loop
    v := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.ws_workshops w where w.short_code = v and w.status in ('draft','confirmed','live'));
    i := i + 1;
    if i > 200 then raise exception 'no free workshop number' using errcode = 'P0001'; end if;
  end loop;
  return v;
end $$;

create or replace function public.ws_workshops_short_code_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status in ('confirmed', 'live') and new.short_code is null then
    new.short_code := public.ws_free_short_code();
  elsif new.status in ('completed', 'archived', 'cancelled') then
    new.short_code := null;
  end if;
  return new;
end $$;
drop trigger if exists ws_workshops_short_code_guard on public.ws_workshops;
create trigger ws_workshops_short_code_guard before insert or update of status on public.ws_workshops
  for each row execute function public.ws_workshops_short_code_guard();
revoke all on function public.ws_workshops_short_code_guard() from public, anon, authenticated;

create or replace function public.ws_rotate_short_code(p_workshop uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v text;
begin
  if not public.ws_can_edit_workshop(p_workshop) then raise exception 'not authorized' using errcode = '42501'; end if;
  v := public.ws_free_short_code();
  update public.ws_workshops set short_code = v where id = p_workshop and status in ('confirmed','live');
  if not found then raise exception 'workshop is not open' using errcode = '22023'; end if;
  return v;
end $$;
revoke all on function public.ws_rotate_short_code(uuid) from public, anon;
grant execute on function public.ws_rotate_short_code(uuid) to authenticated;

-- ws_find_workshop(p_code) and ws_join_group(p_code, ...) now match upper(code) OR short_code (live only);
-- ws_find_workshop returns short_code as well. Device attempts for the number path:
create table if not exists public.ws_number_attempts (
  id bigserial primary key,
  device_key text not null,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ws_number_attempts_dev on public.ws_number_attempts (device_key, created_at);
alter table public.ws_number_attempts enable row level security;
revoke all on public.ws_number_attempts from public, anon, authenticated;
