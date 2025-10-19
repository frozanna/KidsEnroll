-- ============================================================================
-- Migration: Create Initial Schema for KidsEnroll
-- Description: Creates the core database schema including facilities, profiles,
--              workers, children, activities, enrollments, and activity_tags tables
-- Tables affected: facilities, profiles, workers, children, activities, 
--                  enrollments, activity_tags
-- Notes: This migration establishes the foundation for the KidsEnroll application
--        with proper RLS policies for parent and admin roles
-- ============================================================================

-- ============================================================================
-- 1. Create Enum Types
-- ============================================================================

-- user_role enum: defines the two main user types in the system
-- 'admin' - facility administrators with full access
-- 'parent' - parents who can manage their children and enrollments
create type user_role as enum ('admin', 'parent');

-- ============================================================================
-- 2. Create Core Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- facilities table: stores information about preschools/kindergartens
-- ----------------------------------------------------------------------------
create table facilities (
  id serial primary key,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- enable row level security for facilities table
alter table facilities enable row level security;

-- ----------------------------------------------------------------------------
-- profiles table: extends auth.users with application-specific data
-- This table has a 1:1 relationship with auth.users via the id field
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  role user_role not null,
  created_at timestamptz not null default now()
);

-- enable row level security for profiles table
alter table profiles enable row level security;

-- ----------------------------------------------------------------------------
-- workers table: stores information about instructors/caregivers
-- These are the people who lead the activities
-- ----------------------------------------------------------------------------
create table workers (
  id serial primary key,
  first_name text not null,
  last_name text not null,
  email text unique not null,
  created_at timestamptz not null default now()
);

-- enable row level security for workers table
alter table workers enable row level security;

-- ----------------------------------------------------------------------------
-- children table: stores information about children enrolled by parents
-- Each child belongs to a parent (via parent_id referencing profiles)
-- ----------------------------------------------------------------------------
create table children (
  id serial primary key,
  parent_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  description text,
  created_at timestamptz not null default now()
);

-- enable row level security for children table
alter table children enable row level security;

-- ----------------------------------------------------------------------------
-- activities table: stores extracurricular activities offered by facilities
-- Each activity is associated with a facility and a worker (instructor)
-- ----------------------------------------------------------------------------
create table activities (
  id serial primary key,
  facility_id integer not null references facilities(id) on delete cascade,
  worker_id integer not null references workers(id) on delete cascade,
  name text not null,
  description text,
  cost decimal(10,2) not null,
  participant_limit integer not null,
  start_datetime timestamptz not null,
  created_at timestamptz not null default now()
);

-- enable row level security for activities table
alter table activities enable row level security;

-- ----------------------------------------------------------------------------
-- enrollments table: junction table for many-to-many relationship
-- Links children to activities they are enrolled in
-- ----------------------------------------------------------------------------
create table enrollments (
  child_id integer not null references children(id) on delete cascade,
  activity_id integer not null references activities(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (child_id, activity_id)
);

-- enable row level security for enrollments table
alter table enrollments enable row level security;

-- ----------------------------------------------------------------------------
-- activity_tags table: stores tags/categories for activities
-- Allows for flexible categorization and filtering of activities
-- ----------------------------------------------------------------------------
create table activity_tags (
  id serial primary key,
  activity_id integer not null references activities(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now()
);

-- enable row level security for activity_tags table
alter table activity_tags enable row level security;

-- ============================================================================
-- 3. Create Indexes for Performance Optimization
-- ============================================================================

-- index for faster queries filtering activities by date/time
create index idx_activities_start_datetime on activities(start_datetime);

-- index for faster lookups of enrollments by activity
-- used when checking how many children are enrolled in an activity
create index idx_enrollments_activity_id on enrollments(activity_id);

-- index for faster lookups of enrollments by child
-- used when displaying all activities a child is enrolled in
create index idx_enrollments_child_id on enrollments(child_id);

-- index for faster lookups of children by parent
-- used when a parent views or manages their children
create index idx_children_parent_id on children(parent_id);

-- ============================================================================
-- 4. Create Row Level Security (RLS) Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS Policies for facilities table
-- Admins can manage all facilities, parents and anonymous users can view all
-- ----------------------------------------------------------------------------

-- policy: allow authenticated users to view all facilities
create policy "facilities_select_authenticated"
  on facilities
  for select
  to authenticated
  using (true);

-- policy: allow admin users to insert new facilities
create policy "facilities_insert_admin"
  on facilities
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to update facilities
create policy "facilities_update_admin"
  on facilities
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to delete facilities
-- warning: this will cascade delete all associated activities and enrollments
create policy "facilities_delete_admin"
  on facilities
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies for profiles table
-- Users can view and update their own profile, admins can view all profiles
-- ----------------------------------------------------------------------------

-- policy: allow authenticated users to view their own profile
create policy "profiles_select_own"
  on profiles
  for select
  to authenticated
  using (id = auth.uid());

-- policy: allow admin users to view all profiles
create policy "profiles_select_admin"
  on profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow authenticated users to insert their own profile
-- this is typically called once during user registration
create policy "profiles_insert_own"
  on profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- policy: allow authenticated users to update their own profile
create policy "profiles_update_own"
  on profiles
  for update
  to authenticated
  using (id = auth.uid());

-- policy: allow admin users to update any profile
create policy "profiles_update_admin"
  on profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to delete any profile
-- warning: this will cascade delete all data connected to this profile
create policy "profiles_delete_admin"
  on profiles
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );


-- ----------------------------------------------------------------------------
-- RLS Policies for workers table
-- Admins can manage all workers, parents and anonymous users can view all
-- ----------------------------------------------------------------------------

-- policy: allow anonymous users to view all workers
create policy "workers_select_anon"
  on workers
  for select
  to anon
  using (true);

-- policy: allow authenticated users to view all workers
create policy "workers_select_authenticated"
  on workers
  for select
  to authenticated
  using (true);

-- policy: allow admin users to insert new workers
create policy "workers_insert_admin"
  on workers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to update workers
create policy "workers_update_admin"
  on workers
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to delete workers
-- warning: this will cascade delete all activities led by this worker
create policy "workers_delete_admin"
  on workers
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies for children table
-- Parents can only manage their own children, admins can view all children
-- ----------------------------------------------------------------------------

-- policy: allow parents to view their own children
create policy "children_select_own"
  on children
  for select
  to authenticated
  using (parent_id = auth.uid());

-- policy: allow admin users to view all children
create policy "children_select_admin"
  on children
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow parents to insert their own children
create policy "children_insert_own"
  on children
  for insert
  to authenticated
  with check (parent_id = auth.uid());

-- policy: allow parents to update their own children
create policy "children_update_own"
  on children
  for update
  to authenticated
  using (parent_id = auth.uid());

-- policy: allow admin users to update any child
create policy "children_update_admin"
  on children
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );


-- policy: allow admin users to delete any child
-- warning: this will cascade delete all enrollments for this child
create policy "children_delete_admin"
  on children
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies for activities table
-- Admins can manage all activities, parents and anonymous users can view all
-- ----------------------------------------------------------------------------

-- policy: allow anonymous users to view all activities
create policy "activities_select_anon"
  on activities
  for select
  to anon
  using (true);

-- policy: allow authenticated users to view all activities
create policy "activities_select_authenticated"
  on activities
  for select
  to authenticated
  using (true);

-- policy: allow admin users to insert new activities
create policy "activities_insert_admin"
  on activities
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to update activities
create policy "activities_update_admin"
  on activities
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to delete activities
-- warning: this will cascade delete all enrollments and tags for this activity
create policy "activities_delete_admin"
  on activities
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies for enrollments table
-- Parents can only manage enrollments for their own children
-- Admins can view all enrollments
-- ----------------------------------------------------------------------------

-- policy: allow parents to view enrollments for their own children
create policy "enrollments_select_own"
  on enrollments
  for select
  to authenticated
  using (
    exists (
      select 1 from children
      where children.id = enrollments.child_id
      and children.parent_id = auth.uid()
    )
  );

-- policy: allow admin users to view all enrollments
create policy "enrollments_select_admin"
  on enrollments
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow parents to enroll their own children in activities
create policy "enrollments_insert_own"
  on enrollments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from children
      where children.id = enrollments.child_id
      and children.parent_id = auth.uid()
    )
  );

-- policy: allow admin users to enroll any child in activities
create policy "enrollments_insert_admin"
  on enrollments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow parents to unenroll their own children from activities
create policy "enrollments_delete_own"
  on enrollments
  for delete
  to authenticated
  using (
    exists (
      select 1 from children
      where children.id = enrollments.child_id
      and children.parent_id = auth.uid()
    )
  );

-- policy: allow admin users to unenroll any child from activities
create policy "enrollments_delete_admin"
  on enrollments
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies for activity_tags table
-- Admins can manage all tags, parents and anonymous users can view all
-- ----------------------------------------------------------------------------

-- policy: allow anonymous users to view all activity tags
create policy "activity_tags_select_anon"
  on activity_tags
  for select
  to anon
  using (true);

-- policy: allow authenticated users to view all activity tags
create policy "activity_tags_select_authenticated"
  on activity_tags
  for select
  to authenticated
  using (true);

-- policy: allow admin users to insert new activity tags
create policy "activity_tags_insert_admin"
  on activity_tags
  for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to update activity tags
create policy "activity_tags_update_admin"
  on activity_tags
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- policy: allow admin users to delete activity tags
create policy "activity_tags_delete_admin"
  on activity_tags
  for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
