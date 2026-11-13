-- KRAVIA Office final-settlement case evidence for EXIT-05 and EXIT-06.
-- Financial facts remain in the existing LOCKED payroll result and independently
-- verified bank credits. This migration NEVER pays money or sends an email.
-- An activated former-employee delivery worker must separately revalidate both
-- source proof and current independently reviewed personal-mail consent.

CREATE TABLE public.office_exit_settlement_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 offboarding_request_id uuid NOT NULL
  REFERENCES public.office_requests(id) ON DELETE RESTRICT,
 payroll_result_id uuid NOT NULL
  REFERENCES public.office_payroll_results(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','VERIFIED')),
 opened_by uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 opened_at timestamptz NOT NULL DEFAULT now(),
 verified_by uuid REFERENCES public.office_identity_users(user_id),
 verified_at timestamptz,
 review_note text,
 UNIQUE(offboarding_request_id,payroll_result_id),
 CHECK(status<>'VERIFIED' OR (
  verified_by IS NOT NULL AND verified_at IS NOT NULL
  AND verified_by<>opened_by AND verified_by<>employee_user_id
 ))
);
ALTER TABLE public.office_exit_settlement_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_settlement_cases
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_settlement_cases TO service_role;

CREATE TABLE public.office_exit_settlement_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 case_id uuid NOT NULL REFERENCES public.office_exit_settlement_cases(id) ON DELETE RESTRICT,
 employee_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 actor_user_id uuid NOT NULL REFERENCES public.office_identity_users(user_id),
 event_type text NOT NULL CHECK(event_type IN('CASE_OPENED','SETTLEMENT_VERIFIED')),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,event_type)
);
ALTER TABLE public.office_exit_settlement_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_settlement_events
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_settlement_events TO service_role;

CREATE TABLE public.office_exit_settlement_proofs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_code text NOT NULL CHECK(event_code IN('EXIT-05','EXIT-06')),
 source_event_id bigint NOT NULL
  REFERENCES public.office_exit_settlement_events(id) ON DELETE RESTRICT,
 case_id uuid NOT NULL REFERENCES public.office_exit_settlement_cases(id),
 employee_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 contact_version integer NOT NULL CHECK(contact_version>0),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_code,source_event_id,employee_user_id)
);
ALTER TABLE public.office_exit_settlement_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_settlement_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_settlement_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_settlement_source_valid(
 p_proof_id bigint
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $verify$
DECLARE proof public.office_exit_settlement_proofs%rowtype;
BEGIN
 SELECT * INTO proof FROM public.office_exit_settlement_proofs WHERE id=p_proof_id;
 IF proof.id IS NULL OR
    public.office_exit_contact_recipient(proof.employee_user_id) IS NULL
    OR NOT EXISTS(
      SELECT 1 FROM public.office_exit_contact_evidence contact
      WHERE contact.employee_user_id=proof.employee_user_id
        AND contact.version=proof.contact_version
        AND contact.status='VERIFIED' AND contact.revoked_at IS NULL
        AND contact.expires_at>now()
    ) THEN RETURN false; END IF;

 RETURN EXISTS(
  SELECT 1 FROM public.office_exit_settlement_events event
  JOIN public.office_exit_settlement_cases c ON c.id=event.case_id
  JOIN public.office_requests req ON req.id=c.offboarding_request_id
  JOIN public.office_payroll_results result ON result.id=c.payroll_result_id
  WHERE event.id=proof.source_event_id
   AND event.case_id=proof.case_id
   AND event.employee_user_id=proof.employee_user_id
   AND c.employee_user_id=proof.employee_user_id
   AND req.request_type_code='EMPLOYEE_OFFBOARDING'
   AND req.target_user_id=proof.employee_user_id
   AND req.status IN('APPROVED','FULFILLED')
   AND result.employee_user_id=proof.employee_user_id
   AND result.status='LOCKED' AND result.net_pay_minor>0
   AND (
     (proof.event_code='EXIT-05'
       AND event.event_type='CASE_OPENED'
       AND c.status IN('OPEN','VERIFIED'))
     OR
     (proof.event_code='EXIT-06'
       AND event.event_type='SETTLEMENT_VERIFIED'
       AND c.status='VERIFIED' AND c.verified_by=event.actor_user_id
       AND c.verified_by IS DISTINCT FROM c.opened_by
       AND c.verified_by IS DISTINCT FROM c.employee_user_id
       AND c.verified_at IS NOT NULL
       AND (
         SELECT COALESCE(sum(credit.amount_minor),0)
         FROM public.office_salary_settlement_evidence credit
         WHERE credit.payroll_result_id=c.payroll_result_id
           AND credit.status='VERIFIED'
           AND credit.currency=result.currency
           AND credit.verified_at IS NOT NULL
           AND credit.verified_by IS NOT NULL
           AND credit.verified_by IS DISTINCT FROM credit.submitted_by
           AND credit.verified_by IS DISTINCT FROM c.verified_by
       )>=result.net_pay_minor)
   )
 );
END;
$verify$;
REVOKE ALL ON FUNCTION public.office_exit_settlement_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_settlement_source_valid(bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_settlement_event_source()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $source$
DECLARE v_code text;v_version integer;
BEGIN
 IF NEW.event_type='CASE_OPENED' THEN v_code:='EXIT-05';
 ELSIF NEW.event_type='SETTLEMENT_VERIFIED' THEN v_code:='EXIT-06';
 ELSE RETURN NEW; END IF;
 SELECT contact.version INTO v_version
 FROM public.office_exit_contact_evidence contact
 WHERE contact.employee_user_id=NEW.employee_user_id
   AND contact.status='VERIFIED' AND contact.revoked_at IS NULL
   AND contact.expires_at>now() AND contact.reviewed_by IS NOT NULL
   AND contact.reviewed_by IS DISTINCT FROM contact.recorded_by;
 IF v_version IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.office_exit_settlement_proofs(
  event_code,source_event_id,case_id,employee_user_id,contact_version
 ) VALUES(v_code,NEW.id,NEW.case_id,NEW.employee_user_id,v_version)
 ON CONFLICT(event_code,source_event_id,employee_user_id) DO NOTHING;
 RETURN NEW;
END;
$source$;
REVOKE ALL ON FUNCTION public.office_exit_settlement_event_source()
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
CREATE TRIGGER office_exit_settlement_source_on_immutable_event
 AFTER INSERT ON public.office_exit_settlement_events
 FOR EACH ROW EXECUTE FUNCTION public.office_exit_settlement_event_source();

CREATE OR REPLACE FUNCTION public.office_exit_settlement_open(
 p_actor uuid,p_employee uuid,p_request uuid,p_result uuid,p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $open$
DECLARE
 v_reason text:=btrim(COALESCE(p_reason,''));
 v_id uuid;
BEGIN
 IF p_actor=p_employee OR char_length(v_reason) NOT BETWEEN 12 AND 500
    OR NOT EXISTS(
      SELECT 1 FROM public.office_identity_users actor
      WHERE actor.user_id=p_actor AND actor.status='ACTIVE')
    OR NOT public.office_effective_permission(
      p_actor,'people.update','COMPANY',NULL,NULL)
    OR NOT EXISTS(
      SELECT 1 FROM public.office_requests req
      JOIN public.office_employment_registry employment
        ON employment.identity_user_id=req.target_user_id
      WHERE req.id=p_request AND req.request_type_code='EMPLOYEE_OFFBOARDING'
        AND req.target_user_id=p_employee
        AND req.status IN('APPROVED','FULFILLED')
        AND employment.relationship_type='EMPLOYEE'
        AND employment.end_date IS NOT NULL
    ) OR NOT EXISTS(
      SELECT 1 FROM public.office_payroll_results result
      WHERE result.id=p_result AND result.employee_user_id=p_employee
        AND result.status='LOCKED' AND result.net_pay_minor>0
    ) THEN
   RAISE EXCEPTION 'Verified offboarding and locked payroll evidence are required';
 END IF;
 INSERT INTO public.office_exit_settlement_cases(
  employee_user_id,offboarding_request_id,payroll_result_id,opened_by
 ) VALUES(p_employee,p_request,p_result,p_actor)
 ON CONFLICT(offboarding_request_id,payroll_result_id) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN
   RAISE EXCEPTION 'Final settlement case already exists';
 END IF;
 INSERT INTO public.office_exit_settlement_events(
  case_id,employee_user_id,actor_user_id,event_type,reason
 ) VALUES(v_id,p_employee,p_actor,'CASE_OPENED',v_reason);
 RETURN v_id;
END;
$open$;
REVOKE ALL ON FUNCTION public.office_exit_settlement_open(
 uuid,uuid,uuid,uuid,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_settlement_open(
 uuid,uuid,uuid,uuid,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_settlement_verify(
 p_actor uuid,p_case uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $verify$
DECLARE
 v public.office_exit_settlement_cases%rowtype;
 pay public.office_payroll_results%rowtype;
 v_total bigint;
 v_reason text:=btrim(COALESCE(p_reason,''));
BEGIN
 SELECT * INTO v FROM public.office_exit_settlement_cases
  WHERE id=p_case FOR UPDATE;
 IF v.id IS NULL OR v.status<>'OPEN' OR p_actor=v.opened_by
   OR p_actor=v.employee_user_id
   OR char_length(v_reason) NOT BETWEEN 12 AND 500
   OR NOT EXISTS(
    SELECT 1 FROM public.office_identity_users actor
    JOIN public.office_user_roles role ON role.user_id=actor.user_id
    WHERE actor.user_id=p_actor AND actor.status='ACTIVE' AND role.role='OWNER'
      AND (role.expires_at IS NULL OR role.expires_at>now())
   ) THEN
   RAISE EXCEPTION 'Independent Owner review is required';
 END IF;
 SELECT * INTO pay FROM public.office_payroll_results
  WHERE id=v.payroll_result_id;
 IF pay.id IS NULL OR pay.status<>'LOCKED' OR pay.net_pay_minor<=0
   OR pay.employee_user_id IS DISTINCT FROM v.employee_user_id THEN
   RAISE EXCEPTION 'Immutable locked payroll result is required';
 END IF;
 SELECT COALESCE(sum(credit.amount_minor),0) INTO v_total
 FROM public.office_salary_settlement_evidence credit
 WHERE credit.payroll_result_id=v.payroll_result_id
   AND credit.status='VERIFIED' AND credit.currency=pay.currency
   AND credit.verified_at IS NOT NULL AND credit.verified_by IS NOT NULL
   AND credit.verified_by IS DISTINCT FROM credit.submitted_by
   AND credit.verified_by IS DISTINCT FROM p_actor;
 IF v_total<pay.net_pay_minor THEN
   RAISE EXCEPTION 'Independently verified bank credits do not cover full net payroll';
 END IF;
 UPDATE public.office_exit_settlement_cases
 SET status='VERIFIED',verified_by=p_actor,verified_at=now(),
     review_note=v_reason
 WHERE id=p_case;
 INSERT INTO public.office_exit_settlement_events(
  case_id,employee_user_id,actor_user_id,event_type,reason
 ) VALUES(p_case,v.employee_user_id,p_actor,'SETTLEMENT_VERIFIED',v_reason);
 RETURN true;
END;
$verify$;
REVOKE ALL ON FUNCTION public.office_exit_settlement_verify(
 uuid,uuid,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_settlement_verify(
 uuid,uuid,text
) TO service_role;

COMMENT ON TABLE public.office_exit_settlement_proofs IS
 'EXIT-05/06 source evidence only. Does not initiate payments, mark source_ready, enqueue mail, or grant external delivery permission.';
