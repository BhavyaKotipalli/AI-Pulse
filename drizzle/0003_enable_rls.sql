-- Defense in depth for hosts that expose the public schema over an HTTP data API
-- (e.g. Supabase PostgREST): with RLS enabled and no policies, API roles can read or
-- write nothing. The application connects as the table owner, which bypasses RLS.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
