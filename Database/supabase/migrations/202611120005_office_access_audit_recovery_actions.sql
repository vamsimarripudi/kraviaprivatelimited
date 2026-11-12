-- Align the closed Office access-audit catalog with supported first-party auth actions.
-- Production bug: recovery email submission succeeded, then the web BFF raised
-- "Access audit write failed" because PASSWORD_RECOVERY_ISSUED was disallowed.
-- The same omission affected invitation reissue. Preserve the original actions;
-- do not relax the CHECK into an unrestricted free-text audit action.
ALTER TABLE public.office_access_audit
  DROP CONSTRAINT office_access_audit_action_check,
  ADD CONSTRAINT office_access_audit_action_check
  CHECK (
    action = ANY (
      ARRAY[
        'INVITE_CREATED',
        'INVITE_ACCEPTED',
        'INVITE_REVOKED',
        'INVITE_EXPIRED',
        'INVITE_FAILED',
        'INVITE_REISSUED',
        'IDENTITY_ACTIVATED',
        'IDENTITY_SUSPENDED',
        'IDENTITY_REACTIVATED',
        'IDENTITY_REVOKED',
        'ROLE_GRANTED',
        'ROLE_REVOKED',
        'ROLE_EXPIRED',
        'DEPARTMENT_CHANGED',
        'ACCESS_REVIEW_APPROVED',
        'ACCESS_REVIEW_CHANGES_REQUIRED',
        'MFA_RESET',
        'PASSWORD_RECOVERY_ISSUED',
        'JOB_ASSIGNMENT_CHANGED',
        'PROFILE_ASSIGNED',
        'PROFILE_REVOKED',
        'PERMISSION_OVERRIDE_GRANTED',
        'PERMISSION_OVERRIDE_DENIED',
        'PERMISSION_OVERRIDE_REVOKED',
        'DEVICE_REGISTERED',
        'DEVICE_APPROVED',
        'DEVICE_REVOKED'
      ]::text[]
    )
  );

COMMENT ON CONSTRAINT office_access_audit_action_check
  ON public.office_access_audit IS
  'Governed Office access actions, including mailbox password recovery and controlled invitation reissue.';
