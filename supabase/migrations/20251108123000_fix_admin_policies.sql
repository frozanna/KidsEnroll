-- Migration: replace admin RLS checks with helper function to avoid recursion
begin;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_admin() to anon;

drop policy if exists "facilities_insert_admin" on facilities;
create policy "facilities_insert_admin"
  on facilities
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "facilities_update_admin" on facilities;
create policy "facilities_update_admin"
  on facilities
  for update
  to authenticated
  using (public.is_admin());

drop policy if exists "facilities_delete_admin" on facilities;
create policy "facilities_delete_admin"
  on facilities
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_select_admin" on profiles;
create policy "profiles_select_admin"
  on profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin"
  on profiles
  for update
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin"
  on profiles
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "children_select_admin" on children;
create policy "children_select_admin"
  on children
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "children_update_admin" on children;
create policy "children_update_admin"
  on children
  for update
  to authenticated
  using (public.is_admin());

drop policy if exists "children_delete_admin" on children;
create policy "children_delete_admin"
  on children
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "activities_insert_admin" on activities;
create policy "activities_insert_admin"
  on activities
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "activities_update_admin" on activities;
create policy "activities_update_admin"
  on activities
  for update
  to authenticated
  using (public.is_admin());

drop policy if exists "activities_delete_admin" on activities;
create policy "activities_delete_admin"
  on activities
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "enrollments_select_admin" on enrollments;
create policy "enrollments_select_admin"
  on enrollments
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "enrollments_insert_admin" on enrollments;
create policy "enrollments_insert_admin"
  on enrollments
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "enrollments_delete_admin" on enrollments;
create policy "enrollments_delete_admin"
  on enrollments
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "activity_tags_insert_admin" on activity_tags;
create policy "activity_tags_insert_admin"
  on activity_tags
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "activity_tags_update_admin" on activity_tags;
create policy "activity_tags_update_admin"
  on activity_tags
  for update
  to authenticated
  using (public.is_admin());

drop policy if exists "activity_tags_delete_admin" on activity_tags;
create policy "activity_tags_delete_admin"
  on activity_tags
  for delete
  to authenticated
  using (public.is_admin());

commit;
