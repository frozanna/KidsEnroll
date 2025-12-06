-- Create secure RPC to read emails from auth.users for given user IDs
-- Purpose: Allow backend to display parent emails in admin lists without storing duplicates
-- Security: SECURITY DEFINER, limited to returning id+email; grant execute to authenticated role

create or replace function public.get_auth_emails(user_ids uuid[])
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select u.id as user_id, u.email
  from auth.users u
  where u.id = any (user_ids);
$$;

grant execute on function public.get_auth_emails(uuid[]) to authenticated;
