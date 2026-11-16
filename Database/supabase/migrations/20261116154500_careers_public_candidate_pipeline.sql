-- KRAVIA public Careers: private applicant records, approved requisition publications.
-- All applicant data is service-only; no anon/authenticated SELECT grants.
BEGIN;

CREATE TABLE IF NOT EXISTS public.office_career_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL UNIQUE REFERENCES public.office_hiring_requisitions(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 4 AND 100),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 140),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 25 AND 1000),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 50 AND 12000),
  requirements text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','PAUSED','CLOSED')),
  expires_at timestamptz,
  published_at timestamptz,
  published_by uuid REFERENCES public.office_identity_users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publication_expiration_after_publish CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at>published_at)
);
CREATE INDEX IF NOT EXISTS office_career_publications_live_idx ON public.office_career_publications(status,expires_at,published_at);
CREATE OR REPLACE FUNCTION public.office_careers_publication_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE req public.office_hiring_requisitions%rowtype;
BEGIN
  SELECT * INTO req FROM public.office_hiring_requisitions WHERE id=NEW.requisition_id;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Hiring requisition is required'; END IF;
  IF NEW.status='PUBLISHED' AND
    (req.status<>'OPEN' OR req.approved_at IS NULL OR req.opened_at IS NULL OR req.openings<1
    OR (NEW.expires_at IS NOT NULL AND NEW.expires_at<=now()))
  THEN RAISE EXCEPTION 'Only approved, currently OPEN requisitions can be published'; END IF;
  IF NEW.status='PUBLISHED' AND NEW.published_by IS NULL THEN
    RAISE EXCEPTION 'Authorized publication actor is required';
  END IF;
  NEW.updated_at := now();
  NEW.version := CASE WHEN TG_OP='UPDATE' THEN OLD.version+1 ELSE 1 END;
  RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS office_careers_publication_integrity ON public.office_career_publications;
CREATE TRIGGER office_careers_publication_integrity BEFORE INSERT OR UPDATE
ON public.office_career_publications FOR EACH ROW EXECUTE FUNCTION public.office_careers_publication_guard();

CREATE TABLE IF NOT EXISTS public.office_career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_code text NOT NULL UNIQUE DEFAULT ('KR-APP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  requisition_id uuid NOT NULL REFERENCES public.office_hiring_requisitions(id) ON DELETE RESTRICT,
  publication_id uuid NOT NULL REFERENCES public.office_career_publications(id) ON DELETE RESTRICT,
  candidate_id uuid UNIQUE REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 220),
  email text NOT NULL CHECK (email=lower(btrim(email)) AND char_length(email) BETWEEN 5 AND 320),
  phone text CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 32),
  location_text text,
  cover_note text,
  status text NOT NULL DEFAULT 'PENDING_EMAIL'
    CHECK(status IN ('PENDING_EMAIL','VERIFIED','IMPORTED','WITHDRAWN','REJECTED','ARCHIVED')),
  privacy_notice_version text NOT NULL CHECK(length(privacy_notice_version) BETWEEN 5 AND 60),
  privacy_accepted_at timestamptz NOT NULL,
  communication_requested boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  imported_at timestamptz,
  imported_by uuid REFERENCES public.office_identity_users(user_id),
  resume_path text,
  resume_sha256 text CHECK(resume_sha256 IS NULL OR resume_sha256 ~ '^[0-9a-f]{64}$'),
  resume_scan_status text NOT NULL DEFAULT 'NOT_PROVIDED'
    CHECK(resume_scan_status IN ('NOT_PROVIDED','QUARANTINED','SCANNED_CLEAN','REJECTED')),
  resume_mime text,
  resume_bytes integer CHECK(resume_bytes IS NULL OR (resume_bytes BETWEEN 1 AND 4194304)),
  resume_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requisition_id,email)
);
CREATE INDEX IF NOT EXISTS office_career_applications_queue_idx
  ON public.office_career_applications(status,created_at DESC);
CREATE INDEX IF NOT EXISTS office_career_applications_candidate_idx
  ON public.office_career_applications(candidate_id) WHERE candidate_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.office_career_tokens (
  token_hash char(64) PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
  application_id uuid NOT NULL REFERENCES public.office_career_applications(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK(purpose IN ('VERIFY','LOGIN','SESSION')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS office_career_tokens_lookup_idx
ON public.office_career_tokens(application_id,purpose,expires_at DESC);
CREATE TABLE IF NOT EXISTS public.office_career_rate_limits (
  fingerprint char(64) NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
  hour_bucket timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 100),
  PRIMARY KEY(fingerprint,hour_bucket)
);
CREATE OR REPLACE FUNCTION public.office_career_rate_consume(p_fingerprint char(64),p_max integer DEFAULT 8)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_attempts integer;
BEGIN
 IF p_max<1 OR p_max>30 OR p_fingerprint !~ '^[0-9a-f]{64}$' THEN RETURN FALSE; END IF;
 INSERT INTO public.office_career_rate_limits(fingerprint,hour_bucket,attempts)
 VALUES (p_fingerprint,date_trunc('hour',now()),1)
 ON CONFLICT(fingerprint,hour_bucket) DO UPDATE SET attempts=public.office_career_rate_limits.attempts+1
 WHERE public.office_career_rate_limits.attempts<p_max
 RETURNING attempts INTO v_attempts;
 RETURN v_attempts IS NOT NULL;
END;$fn$;

CREATE TABLE IF NOT EXISTS public.office_career_candidate_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.office_career_applications(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.office_candidates(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES public.office_offer_proposals(id) ON DELETE RESTRICT,
  interview_id uuid REFERENCES public.office_candidate_interviews(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK(action_type IN
    ('WITHDRAWAL','INTERVIEW_CONFIRMATION','RESCHEDULE_REQUEST','OFFER_ACKNOWLEDGED','DOCUMENT_UPLOADED','CONSENT_REVOKED')),
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN('SUBMITTED','REVIEWED','CLOSED')),
  typed_name text,
  evidence_sha256 text CHECK(evidence_sha256 IS NULL OR evidence_sha256 ~ '^[0-9a-f]{64}$'),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS office_career_unique_offer_ack ON public.office_career_candidate_actions(application_id,offer_id,action_type)
 WHERE action_type='OFFER_ACKNOWLEDGED';
CREATE INDEX IF NOT EXISTS office_career_candidate_actions_queue ON public.office_career_candidate_actions(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.office_career_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.office_career_applications(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK(event_type IN ('EMAIL_VERIFICATION','APPLICATION_RECEIPT','ACCESS_LINK','WITHDRAWAL_RECEIPT','OFFER_ACKNOWLEDGEMENT')),
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED','UNKNOWN')),
  provider_message_id text,
  error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS office_career_email_events_status ON public.office_career_email_events(status,created_at);

-- The original candidate- and document-system tables remain unchanged.
-- Private uploads never receive anon/authenticated storage read policies.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('office-career-quarantine','office-career-quarantine',false,4194304,ARRAY['application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=4194304,allowed_mime_types=ARRAY['application/pdf'];

DO $block$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'office_career_publications','office_career_applications','office_career_tokens',
  'office_career_rate_limits','office_career_candidate_actions','office_career_email_events'
 ] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO service_role',t);
 END LOOP;
END;$block$;
REVOKE ALL ON FUNCTION public.office_career_rate_consume(char(64),integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_career_rate_consume(char(64),integer) TO service_role;
COMMIT;
