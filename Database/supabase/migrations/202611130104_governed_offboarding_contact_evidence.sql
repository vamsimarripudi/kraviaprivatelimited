-- KRAVIA Office: evidence-gated alternate contact for offboarded employees.
-- Development only. No retroactive recipient migration, policy activation,
-- notifications, external provider calls, or status changes to employees.
-- A former employee's disabled corporate mailbox must NEVER be used as an
-- implicit or fabricated personal delivery address.

CREATE TABLE IF NOT EXISTS public.office_exit_contact_evidence (
  employee_user_id uuid PRIMARY KEY
    REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  personal_email text NOT NULL
    CHECK (
      personal_email=lower(btrim(personal_email))
      AND char_length(personal_email) BETWEEN 6 AND 320
      AND personal_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][A-Za-z]{2,}$'
      AND personal_email !~* '@kraviaprivatelimited[.]com$'
    ),
  consent_source text NOT NULL
    CHECK(consent_source IN(
      'SIGNED_EXIT_FORM','VERIFIED_EMPLOYEE_REPLY','SIGNED_EMPLOYMENT_CONSENT'
    )),
  evidence_reference text NOT NULL
    CHECK(char_length(btrim(evidence_reference)) BETWEEN 12 AND 500),
  recorded_by uuid NOT NULL
    REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid
    REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK(status IN('PENDING','VERIFIED','REJECTED','REVOKED')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  review_note text,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(expires_at>recorded_at AND expires_at<=recorded_at+interval '180 days'),
  CHECK(reviewed_by IS NULL OR reviewed_by<>recorded_by),
  CHECK(status<>'VERIFIED' OR (
    reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND revoked_at IS NULL
  )),
  CHECK(status<>'REVOKED' OR revoked_at IS NOT NULL)
);
ALTER TABLE public.office_exit_contact_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_contact_evidence
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_contact_evidence TO service_role;

-- Store the trail separately: no personal address in event records, no
-- mutable event history, and nothing can be sent from this table.
CREATE TABLE IF NOT EXISTS public.office_exit_contact_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_user_id uuid NOT NULL
    REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL
    REFERENCES public.office_identity_users(user_id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version>0),
  event_type text NOT NULL
    CHECK(event_type IN('RECORDED','VERIFIED','REJECTED','REVOKED')),
  reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 12 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_user_id,version,event_type)
);
ALTER TABLE public.office_exit_contact_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.office_exit_contact_events
  FROM PUBLIC,anon,authenticated,service_role,kravia_office_backend;
GRANT SELECT ON TABLE public.office_exit_contact_events TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_contact_record(
  p_actor uuid,p_employee uuid,p_email text,p_source text,
  p_reference text,p_reason text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $record$
DECLARE
  v_email text:=lower(btrim(COALESCE(p_email,'')));
  v_source text:=upper(btrim(COALESCE(p_source,'')));
  v_reference text:=btrim(COALESCE(p_reference,''));
  v_reason text:=btrim(COALESCE(p_reason,''));
  v_version integer;
BEGIN
  IF p_actor=p_employee OR NOT EXISTS(
     SELECT 1 FROM public.office_identity_users i
     WHERE i.user_id=p_actor AND i.status='ACTIVE'
  ) OR NOT (
    public.office_effective_permission(p_actor,'people.update','COMPANY',NULL,NULL)
  ) THEN
    RAISE EXCEPTION 'Active independent People authority is required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.office_employment_registry employment
    WHERE employment.identity_user_id=p_employee
      AND employment.relationship_type='EMPLOYEE'
  ) THEN RAISE EXCEPTION 'Verified employment record is required'; END IF;
  IF v_source NOT IN(
     'SIGNED_EXIT_FORM','VERIFIED_EMPLOYEE_REPLY','SIGNED_EMPLOYMENT_CONSENT'
  ) OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][A-Za-z]{2,}$'
     OR char_length(v_email) NOT BETWEEN 6 AND 320
     OR v_email ~* '@kraviaprivatelimited[.]com$'
     OR char_length(v_reference) NOT BETWEEN 12 AND 500
     OR char_length(v_reason) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'Authentic personal contact and documented consent evidence are required';
  END IF;
  INSERT INTO public.office_exit_contact_evidence(
    employee_user_id,personal_email,consent_source,evidence_reference,
    recorded_by,recorded_at,reviewed_by,reviewed_at,
    status,expires_at,revoked_at,review_note,version,updated_at
  ) VALUES(
    p_employee,v_email,v_source,v_reference,
    p_actor,now(),NULL,NULL,'PENDING',now()+interval '180 days',
    NULL,NULL,1,now()
  ) ON CONFLICT(employee_user_id) DO UPDATE
    SET personal_email=excluded.personal_email,
        consent_source=excluded.consent_source,
        evidence_reference=excluded.evidence_reference,
        recorded_by=excluded.recorded_by,
        recorded_at=now(),
        reviewed_by=NULL,reviewed_at=NULL,
        status='PENDING',expires_at=now()+interval '180 days',
        revoked_at=NULL,review_note=NULL,
        version=public.office_exit_contact_evidence.version+1,
        updated_at=now()
  RETURNING version INTO v_version;
  INSERT INTO public.office_exit_contact_events(
    employee_user_id,actor_user_id,version,event_type,reason
  ) VALUES(p_employee,p_actor,v_version,'RECORDED',v_reason);
  RETURN v_version;
END;
$record$;
REVOKE ALL ON FUNCTION public.office_exit_contact_record(
 uuid,uuid,text,text,text,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_contact_record(
 uuid,uuid,text,text,text,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_contact_decide(
  p_actor uuid,p_employee uuid,p_approved boolean,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $decide$
DECLARE
 v public.office_exit_contact_evidence%rowtype;
 v_reason text:=btrim(COALESCE(p_reason,''));
BEGIN
  SELECT * INTO v FROM public.office_exit_contact_evidence
   WHERE employee_user_id=p_employee FOR UPDATE;
  IF v.employee_user_id IS NULL OR v.status<>'PENDING'
     OR v.expires_at<=now() OR p_actor=v.recorded_by
     OR char_length(v_reason) NOT BETWEEN 12 AND 500 THEN
    RAISE EXCEPTION 'Current independent consent review is required';
  END IF;
  -- Owner makes the high-risk alternative-recipient approval, not the HR
  -- employee who submitted the address. This is not self-verification.
  IF NOT EXISTS (
    SELECT 1 FROM public.office_identity_users actor
    JOIN public.office_user_roles role ON role.user_id=actor.user_id
    WHERE actor.user_id=p_actor AND actor.status='ACTIVE'
      AND role.role='OWNER'
      AND (role.expires_at IS NULL OR role.expires_at>now())
  ) THEN RAISE EXCEPTION 'Independent current Owner approval is required'; END IF;
  UPDATE public.office_exit_contact_evidence SET
    reviewed_by=p_actor,reviewed_at=now(),review_note=v_reason,
    status=CASE WHEN p_approved THEN 'VERIFIED' ELSE 'REJECTED' END,
    updated_at=now()
  WHERE employee_user_id=p_employee;
  INSERT INTO public.office_exit_contact_events(
    employee_user_id,actor_user_id,version,event_type,reason
  ) VALUES(
    p_employee,p_actor,v.version,
    CASE WHEN p_approved THEN 'VERIFIED' ELSE 'REJECTED' END,
    v_reason
  );
  RETURN true;
END;
$decide$;
REVOKE ALL ON FUNCTION public.office_exit_contact_decide(
 uuid,uuid,boolean,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_contact_decide(
 uuid,uuid,boolean,text
) TO service_role;

CREATE OR REPLACE FUNCTION public.office_exit_contact_revoke(
 p_actor uuid,p_employee uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $revoke$
DECLARE v public.office_exit_contact_evidence%rowtype;
        v_reason text:=btrim(COALESCE(p_reason,''));
BEGIN
 SELECT * INTO v FROM public.office_exit_contact_evidence
 WHERE employee_user_id=p_employee FOR UPDATE;
 IF v.employee_user_id IS NULL THEN RAISE EXCEPTION 'Contact record not found'; END IF;
 IF v.status='REVOKED' THEN RETURN true; END IF;
 IF char_length(v_reason) NOT BETWEEN 12 AND 500
 OR NOT EXISTS(SELECT 1 FROM public.office_identity_users
               WHERE user_id=p_actor AND status='ACTIVE')
 OR NOT public.office_effective_permission(
    p_actor,'people.update','COMPANY',NULL,NULL
 ) THEN RAISE EXCEPTION 'Authorized evidence-backed revocation is required'; END IF;
 UPDATE public.office_exit_contact_evidence
 SET status='REVOKED',revoked_at=now(),updated_at=now(),review_note=v_reason
 WHERE employee_user_id=p_employee;
 INSERT INTO public.office_exit_contact_events(
   employee_user_id,actor_user_id,version,event_type,reason
 ) VALUES(p_employee,p_actor,v.version,'REVOKED',v_reason);
 RETURN true;
END;
$revoke$;
REVOKE ALL ON FUNCTION public.office_exit_contact_revoke(
 uuid,uuid,text
) FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_contact_revoke(
 uuid,uuid,text
) TO service_role;

-- Future offboarding mail workers must call this privileged, current-state
-- lookup; a removed or re-keyed recipient may never inherit a stale address.
CREATE OR REPLACE FUNCTION public.office_exit_contact_recipient(
 p_employee uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $lookup$
  SELECT c.personal_email
  FROM public.office_exit_contact_evidence c
  WHERE c.employee_user_id=p_employee
    AND c.status='VERIFIED'
    AND c.revoked_at IS NULL
    AND c.reviewed_by IS NOT NULL
    AND c.reviewed_by<>c.recorded_by
    AND c.reviewed_at IS NOT NULL
    AND c.expires_at>now()
  LIMIT 1;
$lookup$;
REVOKE ALL ON FUNCTION public.office_exit_contact_recipient(uuid)
 FROM PUBLIC,anon,authenticated,kravia_office_backend;
GRANT EXECUTE ON FUNCTION public.office_exit_contact_recipient(uuid)
 TO service_role;

COMMENT ON TABLE public.office_exit_contact_evidence IS
 'Restricted, two-person verified former-employee contact evidence. Never an email dispatch source by itself.';
