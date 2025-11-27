-- Migration: add SECURITY DEFINER RPC for full enrollment counts
-- Purpose: allow parent role to obtain total enrollments per activity (bypassing RLS on enrollments)
-- Function: public.get_enrollment_counts(activity_ids int[])
-- Returns: table(activity_id int, enrollment_count bigint)
-- Notes:
--  - SECURITY DEFINER bypasses RLS so counts reflect all children, not only caller's.
--  - Accepts an array of activity IDs; duplicates are ignored via join on activities.
--  - Grants execute to anon/authenticated/service_role for read-only usage.
--  - Does not expose child_ids.

create or replace function public.get_enrollment_counts(activity_ids int[])
returns table(activity_id int, enrollment_count bigint)
language sql
security definer
set search_path = public
as $$
  select a.id as activity_id,
         count(e.child_id) as enrollment_count
  from unnest(activity_ids) as a_id
  join activities a on a.id = a_id
  left join enrollments e on e.activity_id = a.id
  group by a.id
  order by a.id;
$$;

grant execute on function public.get_enrollment_counts(int[]) to anon;
grant execute on function public.get_enrollment_counts(int[]) to authenticated;
grant execute on function public.get_enrollment_counts(int[]) to service_role;
