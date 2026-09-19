-- Require a Supabase user session on the phone voting entry point while
-- preserving pulse_submit for the installation's anonymous controls.
begin;

create or replace function public.pulse_submit_authenticated(
  p_request_id uuid,
  p_choices integer[]
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise sqlstate 'PT401' using message = 'Sign in to vote.';
  end if;
  return pulse_private.submit_impl(p_request_id, p_choices);
end
$$;

revoke all on function public.pulse_submit_authenticated(uuid, integer[])
  from public, anon, authenticated;
grant execute on function public.pulse_submit_authenticated(uuid, integer[])
  to authenticated;

commit;
