-- Private Careers security boundary test. Does not mutate company data.
DO $$
DECLARE t text; rel oid; is_rls boolean;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'office_career_publications','office_career_applications','office_career_tokens',
  'office_career_rate_limits','office_career_candidate_actions','office_career_email_events',
  'office_career_candidate_uploads','office_career_onboarding_handoffs'
 ] LOOP
   SELECT c.oid,c.relrowsecurity INTO rel,is_rls FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=t;
   IF rel IS NULL OR is_rls IS DISTINCT FROM TRUE THEN
     RAISE EXCEPTION 'Missing private RLS table: %',t;
   END IF;
   IF has_table_privilege('anon',rel,'SELECT')
     OR has_table_privilege('authenticated',rel,'SELECT')
     OR has_table_privilege('anon',rel,'INSERT')
     OR has_table_privilege('authenticated',rel,'INSERT') THEN
     RAISE EXCEPTION 'Unapproved Data API privilege on: %',t;
   END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='office-career-quarantine' AND public=false) THEN
   RAISE EXCEPTION 'Private quarantine storage is missing';
 END IF;
 IF has_function_privilege('anon','public.office_career_adopt_application(uuid,uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.office_career_adopt_application(uuid,uuid)','EXECUTE')
   OR has_function_privilege('anon','public.office_career_accept_signed_offer(uuid,uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.office_career_accept_signed_offer(uuid,uuid)','EXECUTE')
   OR has_function_privilege('anon','public.office_career_employee_link(uuid,uuid,uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Public role must not invoke private recruitment RPCs';
 END IF;
 RAISE NOTICE 'CAREERS PRIVATE RLS / RPC BOUNDARY GREEN';
END$$;
