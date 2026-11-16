-- KRAVIA Office 2026-11-17: enterprise department access and performance.
-- No ownership or role assignments change. No broad read for ADMIN/CS titles.
-- Only CURRENT department owners receive named, low-risk read actions.
-- Device-restricted reads remain subject to the existing device enforcement.
-- Former-owner write DENY remains intact.

CREATE OR REPLACE FUNCTION public.office_department_permission_verdict(p_actor uuid, p_permission text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  department text;
  permission_action text;
  current_owner uuid;
  baseline_read_allowed boolean;
BEGIN
  SELECT p.action INTO permission_action FROM public.office_permission_catalog p
  WHERE p.code=p_permission AND p.active=true;
  IF permission_action IS NULL THEN RETURN 'DENY'; END IF;

  department:=public.office_department_for_permission(p_permission);
  IF department IS NULL THEN RETURN 'DEFAULT'; END IF;

  SELECT o.owner_user_id INTO current_owner
  FROM public.office_department_ownership o
  WHERE o.department_code=department;

  IF permission_action='VIEW' OR permission_action='AUDIT_USAGE'
     OR permission_action LIKE 'READ%' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.office_permission_catalog p
      WHERE p.code=p_permission AND p.active=true
        AND p.high_risk=false AND p.owner_bypass IS DISTINCT FROM false
        AND p.code IN (
          -- Established low-risk baselines.
          'finance.read','people.basic.read','master.product.read',
          'portfolio.read','strategy.read',
          -- Purpose-specific owned department entrypoints; no financial,
          -- HR-sensitive or unassigned commercial data is granted.
          'support.case.read','secretarial.board.read',
          'customer.trust.read','registration.read',
          'security.overview.read','operations.asset.read',
          'legal.obligation.read','compliance.rules.read','privacy.case.read'
        )
    ) INTO baseline_read_allowed;
    IF baseline_read_allowed AND current_owner=p_actor AND EXISTS(
      SELECT 1 FROM public.office_identity_users u
      WHERE u.user_id=p_actor AND u.status='ACTIVE'
    ) THEN RETURN 'DEPARTMENT_OWNER'; END IF;
    RETURN 'DEFAULT';
  END IF;

  IF current_owner IS NULL THEN RETURN 'DEFAULT'; END IF;
  IF current_owner=p_actor THEN
    IF EXISTS(SELECT 1 FROM public.office_permission_catalog p
              WHERE p.code=p_permission AND p.owner_bypass IS DISTINCT FROM false)
    THEN RETURN 'DEPARTMENT_OWNER'; END IF;
    RETURN 'DEFAULT';
  END IF;

  IF EXISTS(SELECT 1 FROM public.office_department_former_owners f
            WHERE f.department_code=department AND f.user_id=p_actor)
     OR EXISTS(SELECT 1 FROM public.office_user_roles r
               WHERE r.user_id=p_actor AND r.role='OWNER'
                 AND (r.expires_at IS NULL OR r.expires_at>now()))
  THEN RETURN 'DENY'; END IF;
  RETURN 'DEFAULT';
END;
$fn$;

-- Previous implementation evaluated the verdict RPC once per active permission
-- through LATERAL, issuing repeated PostgreSQL lookups. Batch the catalogue,
-- department ownership, actor status and former-owner read into a set-based
-- query. Do not rely on client-side navigation to authorize any records.
CREATE OR REPLACE FUNCTION public.office_department_capability_changes(p_actor uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH actor_flags AS (
  SELECT
    EXISTS(SELECT 1 FROM public.office_identity_users i
           WHERE i.user_id=p_actor AND i.status='ACTIVE') AS active,
    EXISTS(SELECT 1 FROM public.office_user_roles r
           WHERE r.user_id=p_actor AND r.role='OWNER'
             AND (r.expires_at IS NULL OR r.expires_at>now())) AS is_owner
),
mapped AS (
  SELECT p.code,p.action,p.high_risk,p.owner_bypass,
         public.office_department_for_permission(p.code) AS department
  FROM public.office_permission_catalog p WHERE p.active=true
),
decisions AS (
  SELECT p.code,p.owner_bypass,
    CASE
      WHEN p.department IS NULL THEN 'DEFAULT'
      WHEN p.action IN ('VIEW','AUDIT_USAGE') OR p.action LIKE 'READ%' THEN
        CASE WHEN o.owner_user_id=p_actor AND a.active
          AND p.high_risk=false AND p.owner_bypass IS DISTINCT FROM false
          AND p.code IN (
            'finance.read','people.basic.read','master.product.read',
            'portfolio.read','strategy.read',
            'support.case.read','secretarial.board.read',
            'customer.trust.read','registration.read','security.overview.read',
            'operations.asset.read','legal.obligation.read',
            'compliance.rules.read','privacy.case.read'
          )
        THEN 'DEPARTMENT_OWNER' ELSE 'DEFAULT' END
      WHEN o.owner_user_id IS NULL THEN 'DEFAULT'
      WHEN o.owner_user_id=p_actor THEN
        CASE WHEN p.owner_bypass IS DISTINCT FROM false
          THEN 'DEPARTMENT_OWNER' ELSE 'DEFAULT' END
      WHEN a.is_owner OR EXISTS(
          SELECT 1 FROM public.office_department_former_owners f
          WHERE f.department_code=p.department AND f.user_id=p_actor
        ) THEN 'DENY'
      ELSE 'DEFAULT'
    END AS verdict
  FROM mapped p
  LEFT JOIN public.office_department_ownership o ON o.department_code=p.department
  CROSS JOIN actor_flags a
)
SELECT jsonb_build_object(
 'denied',COALESCE(jsonb_agg(code ORDER BY code) FILTER (WHERE verdict='DENY'),'[]'::jsonb),
 'owned',COALESCE(jsonb_agg(code ORDER BY code) FILTER (
   WHERE verdict='DEPARTMENT_OWNER' AND owner_bypass IS DISTINCT FROM false
 ),'[]'::jsonb)
) FROM decisions;
$fn$;

-- Observe existing ACLs: CREATE OR REPLACE retains existing privilege grants.
-- Grant NO new EXECUTE privileges to browser roles.
