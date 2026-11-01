-- SEMESTA PHOTO SELECTION V10.1 — Admin profile lookup fix
-- Run in Supabase Dashboard > SQL Editor > New query.
-- This function returns only the profile belonging to the signed-in user.

create or replace function public.get_my_admin_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', ap.user_id,
    'display_name', ap.display_name,
    'role', ap.role
  )
  from public.admin_profiles ap
  where ap.user_id = auth.uid()
    and ap.role in ('admin', 'editor')
  limit 1;
$$;

revoke all on function public.get_my_admin_profile() from public;
grant execute on function public.get_my_admin_profile() to authenticated;

-- Ensure authenticated users can invoke PostgREST RPC in public schema.
grant usage on schema public to authenticated;

notify pgrst, 'reload schema';
