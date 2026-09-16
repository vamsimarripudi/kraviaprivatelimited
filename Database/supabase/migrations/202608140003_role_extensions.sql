-- Kept separate so enum values are committed before later Phase 3 policies reference them.
alter type public.corporate_role add value if not exists 'CA';
alter type public.corporate_role add value if not exists 'AUDITOR';
alter type public.corporate_role add value if not exists 'FINANCE_REVIEWER';
alter type public.corporate_role add value if not exists 'COMPLIANCE_REVIEWER';
alter type public.corporate_role add value if not exists 'SYSTEM_ADMIN';
