-- Commit content-domain role values before Phase 5B policies reference them.
-- This migration deliberately creates no users or assignments.
alter type public.corporate_role add value if not exists 'CONTENT_EDITOR';
alter type public.corporate_role add value if not exists 'CORPORATE_REVIEWER';
alter type public.corporate_role add value if not exists 'PRODUCT_REVIEWER';
alter type public.corporate_role add value if not exists 'SECURITY_REVIEWER';
alter type public.corporate_role add value if not exists 'PRIVACY_REVIEWER';
alter type public.corporate_role add value if not exists 'PUBLISHER';
