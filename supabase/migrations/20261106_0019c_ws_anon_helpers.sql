-- 20261106_0019c_ws_anon_helpers — helper functions used by column defaults are not callable by anon.
revoke execute on function public.ws_free_short_code() from public, anon;
revoke execute on function public.ws_random_code() from public, anon;
revoke execute on function public.ws_random_pin() from public, anon;
revoke execute on function public.ws_random_token(integer) from public, anon;
revoke execute on function public.ws_student_caps(text, text) from public, anon;
grant execute on function public.ws_free_short_code() to authenticated, service_role;
grant execute on function public.ws_random_code() to authenticated, service_role;
grant execute on function public.ws_random_pin() to authenticated, service_role;
grant execute on function public.ws_random_token(integer) to authenticated, service_role;
grant execute on function public.ws_student_caps(text, text) to authenticated, service_role;
