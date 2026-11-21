-- Verify the batched function is equivalent to each individual canonical
-- verdict for the entire active catalogue, without granting new titles.
DO $check$
DECLARE
 founder uuid:='00000000-0000-0000-0000-000000000001';
 jaya uuid:='00000000-0000-0000-0000-000000000002';
 manohar uuid:='00000000-0000-0000-0000-000000000003';
 other_actor uuid:='00000000-0000-0000-0000-000000000004';
 actor uuid;
 changes jsonb;
 p record;
 verdict text;
 allow_owned boolean;
 allow_denied boolean;
BEGIN
 FOR actor IN SELECT user_id FROM public.office_identity_users LOOP
   changes:=public.office_department_capability_changes(actor);
   IF jsonb_typeof(changes->'owned')<>'array' OR jsonb_typeof(changes->'denied')<>'array' THEN
     RAISE EXCEPTION 'Malformed grouped capability response';
   END IF;
   FOR p IN SELECT code,owner_bypass FROM public.office_permission_catalog WHERE active=true LOOP
     verdict:=public.office_department_permission_verdict(actor,p.code);
     allow_owned:=(changes->'owned') ? p.code;
     allow_denied:=(changes->'denied') ? p.code;
     IF (verdict='DEPARTMENT_OWNER' AND p.owner_bypass IS DISTINCT FROM false) IS DISTINCT FROM allow_owned
        OR (verdict='DENY') IS DISTINCT FROM allow_denied THEN
       RAISE EXCEPTION 'Batched auth differs from canonical code=% actor=% verdict=%',p.code,actor,verdict;
     END IF;
   END LOOP;
 END LOOP;

 FOR p IN SELECT code FROM public.office_permission_catalog
  WHERE code IN ('support.case.read','secretarial.board.read',
   'customer.trust.read','security.overview.read','registration.read',
   'operations.asset.read','legal.obligation.read','compliance.rules.read',
   'privacy.case.read') LOOP
   IF public.office_department_permission_verdict(jaya,p.code)<>'DEPARTMENT_OWNER' THEN
     RAISE EXCEPTION 'Active department owner read is missing: %',p.code;
   END IF;
 END LOOP;
 IF public.office_department_permission_verdict(jaya,'master.customer.read')<>'DEFAULT' THEN
   RAISE EXCEPTION 'Sales customer master leaked to Customer Success';
 END IF;
 IF public.office_department_permission_verdict(jaya,'finance.read')<>'DEFAULT' THEN
   RAISE EXCEPTION 'Finance visibility leaked to Support/Secretarial owner';
 END IF;
 IF public.office_department_permission_verdict(jaya,'support.refund.approve')<>'DEFAULT' THEN
   RAISE EXCEPTION 'Owner-bypass-false refund approval exposed';
 END IF;
 IF public.office_department_permission_verdict(other_actor,'support.case.read')<>'DEFAULT' THEN
   RAISE EXCEPTION 'Company Secretary title exposed unrelated support data';
 END IF;
 IF public.office_department_permission_verdict(manohar,'people.sensitive.read')<>'DEFAULT' THEN
   RAISE EXCEPTION 'Sensitive HR data exposed through ownership';
 END IF;
 IF public.office_department_permission_verdict(founder,'finance.payment.approve')<>'DENY' THEN
   RAISE EXCEPTION 'Former owner Finance write must remain denied';
 END IF;
 IF public.office_department_permission_verdict(jaya,'disabled.data.read')<>'DENY' THEN
   RAISE EXCEPTION 'Disabled permission unexpectedly granted';
 END IF;
 RAISE NOTICE 'PASS: all permission verdicts equal batched output; owner reads scoped; unrelated and former-owner denials held';
END $check$;
SELECT 'DEPARTMENT_OWNER_SCOPE_BATCHED_VERIFIED' AS result;
