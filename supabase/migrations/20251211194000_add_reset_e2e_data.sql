-- Create an RPC to clean E2E test data in a specific order
-- Order is important:
-- 1. enrollments
-- 2. children
-- 3. activity_tags
-- 4. activities
-- 5. workers

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_e2e_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure operations run atomically
  -- Delete in required order to satisfy foreign keys
  PERFORM 1;

  -- 1. enrollments
  DELETE FROM public.enrollments;

  -- 2. children
  DELETE FROM public.children;

  -- 3. activity_tags
  DELETE FROM public.activity_tags;

  -- 4. activities
  DELETE FROM public.activities;

  -- 5. workers
  DELETE FROM public.workers;
END;
$$;

-- Restrict execution to the Supabase service role only
GRANT EXECUTE ON FUNCTION public.reset_e2e_data() TO service_role;

COMMIT;
