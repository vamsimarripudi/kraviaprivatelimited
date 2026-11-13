-- KRAVIA Office offboarding completion source evidence for EXIT-08.
-- Only an independent Owner can record completion after EVERY prerequisite:
-- approved exit, revoked access, ended employment, returned/wiped assets,
-- fully credited locked payroll, signed relieving document and verified contact.
-- Evidence only. No email worker, bank action, new employee record or
-- lifecycle delivery policy is activated by this migration.

CREATE TABLE public.office_exit_completion_proofs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_code text NOT NULL DEFAULT 'EXIT-08' CHECK(event_code='EXIT-08'),
 settlement_case_id uuid NOT NULL UNIQUE
  REFERENCES public.office_exit_settlement_cases(id) ON DELETE RESTRICT,
 employee_user_id uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 recorded_by uuid NOT NULL
  REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 500),
 contact_version integer NOT NULL CHECK(contact_version>0),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_exit_completion_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_completion_proofs
 FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_completion_proofs TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_completion_preflight(
 p_case uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $preflight$
DECLARE c public.office_exit_settlement_cases%rowtype;
BEGIN
 SELECT * INTO c FROM public.office_exit_settlement_cases WHERE id=p_case;
 IF c.id IS NULL OR c.status<>'VERIFIED' THEN RETURN false; END IF;

 RETURN EXISTS(
   SELECT 1 FROM public.office_requests req
   JOIN public.office_identity_users identity
     ON identity.user_id=req.target_user_id
   JOIN public.office_employment_registry employment
     ON employment.identity_user_id=req.target_user_id
   WHERE req.id=c.offboarding_request_id
     AND req.request_type_code='EMPLOYEE_OFFBOARDING'
     AND req.target_user_id=c.employee_user_id
     AND req.status='FULFILLED'
     AND identity.status='REVOKED'
     AND employment.relationship_type='EMPLOYEE'
     AND employment.status='ENDED'
     AND employment.end_date IS NOT NULL
     AND employment.end_date<=CURRENT_DATE
 ) AND NOT EXISTS(
   SELECT 1 FROM public.office_auth_sessions session
   WHERE session.user_id=c.employee_user_id
     AND session.status='ACTIVE'
 ) AND NOT EXISTS(
   SELECT 1 FROM public.office_asset_lifecycle asset
   WHERE asset.custodian_user_id=c.employee_user_id
     AND (
       asset.lifecycle_status NOT IN('IN_STOCK','READY_FOR_REISSUE','DISPOSED')
       OR (asset.security_wipe_required
           AND asset.wipe_verified_by IS NULL)
     )
 ) AND EXISTS(
   SELECT 1 FROM public.office_exit_settlement_proofs proof
   WHERE proof.case_id=c.id AND proof.employee_user_id=c.employee_user_id
     AND proof.event_code='EXIT-06'
     AND public.office_exit_settlement_source_valid(proof.id)
 ) AND EXISTS(
   SELECT 1 FROM public.office_exit_document_proofs proof
   WHERE proof.employee_user_id=c.employee_user_id
     AND public.office_exit_document_source_valid(proof.id)
 );
END;
$preflight$;
REVOKE ALL ON FUNCTION public.office_exit_completion_preflight(uuid)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_completion_preflight(uuid)
 TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_completion_record(
 p_actor uuid,p_case uuid,p_reason text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $complete$
DECLARE
 c public.office_exit_settlement_cases%rowtype;
 v_version integer;
 v_id bigint;
 v_reason text:=btrim(COALESCE(p_reason,''));
BEGIN
 SELECT * INTO c FROM public.office_exit_settlement_cases
  WHERE id=p_case FOR UPDATE;
 IF c.id IS NULL OR p_actor=c.employee_user_id
    OR p_actor=c.opened_by OR char_length(v_reason) NOT BETWEEN 12 AND 500
    OR NOT EXISTS(
      SELECT 1 FROM public.office_identity_users actor
      JOIN public.office_user_roles role ON role.user_id=actor.user_id
      WHERE actor.user_id=p_actor AND actor.status='ACTIVE'
        AND role.role='OWNER'
        AND (role.expires_at IS NULL OR role.expires_at>now())
    ) THEN RAISE EXCEPTION 'Independent current Owner signoff is required'; END IF;

 IF NOT public.office_exit_completion_preflight(c.id) THEN
   RAISE EXCEPTION 'Outstanding salary, asset, document or access controls block exit completion';
 END IF;

 SELECT contact.version INTO v_version
 FROM public.office_exit_contact_evidence contact
 WHERE contact.employee_user_id=c.employee_user_id
   AND contact.status='VERIFIED'
   AND contact.revoked_at IS NULL AND contact.expires_at>now()
   AND contact.reviewed_by IS NOT NULL
   AND contact.reviewed_by<>contact.recorded_by;
 IF v_version IS NULL THEN
   RAISE EXCEPTION 'Current independent exit contact approval is required';
 END IF;

 INSERT INTO public.office_exit_completion_proofs(
  settlement_case_id,employee_user_id,recorded_by,reason,contact_version
 ) VALUES(c.id,c.employee_user_id,p_actor,v_reason,v_version)
 ON CONFLICT(settlement_case_id) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Offboarding completion is already recorded'; END IF;
 RETURN v_id;
END;
$complete$;
REVOKE ALL ON FUNCTION public.office_exit_completion_record(
 uuid,uuid,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_completion_record(
 uuid,uuid,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_completion_source_valid(
 p_proof_id bigint
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $proof$
DECLARE p public.office_exit_completion_proofs%rowtype;
BEGIN
 SELECT * INTO p FROM public.office_exit_completion_proofs WHERE id=p_proof_id;
 IF p.id IS NULL OR
   public.office_exit_contact_recipient(p.employee_user_id) IS NULL
   OR NOT EXISTS(
      SELECT 1 FROM public.office_exit_contact_evidence contact
      WHERE contact.employee_user_id=p.employee_user_id
        AND contact.version=p.contact_version
        AND contact.status='VERIFIED'
        AND contact.revoked_at IS NULL AND contact.expires_at>now()
   ) OR NOT public.office_exit_completion_preflight(p.settlement_case_id) THEN
   RETURN false;
 END IF;
 RETURN EXISTS(
    SELECT 1 FROM public.office_identity_users actor
    JOIN public.office_user_roles role ON role.user_id=actor.user_id
    WHERE actor.user_id=p.recorded_by AND actor.status='ACTIVE'
      AND role.role='OWNER'
      AND (role.expires_at IS NULL OR role.expires_at>now())
 );
END;
$proof$;
REVOKE ALL ON FUNCTION public.office_exit_completion_source_valid(bigint)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_completion_source_valid(bigint)
 TO service_role;

COMMENT ON TABLE public.office_exit_completion_proofs IS
 'Independent EXIT-08 completion evidence; not a mail outbox. Requires salary, assets, identity, document, and consent controls.';
