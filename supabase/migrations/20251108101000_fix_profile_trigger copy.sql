-- Migration: create trigger to auto insert into profiles after auth.users insert
-- Depends on: initial schema already having profiles table and user_role enum

-- Safety: wrap in transaction
begin;

-- Function to handle new auth user
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert profile row with role from raw_user_meta_data or fallback
  insert into public.profiles (id, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent')::user_role,
    now()
  )
  on conflict (id) do nothing; -- avoid duplicate if rerun

  return new;
end;
$$;

-- Drop existing trigger if present
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_auth_user();

commit;