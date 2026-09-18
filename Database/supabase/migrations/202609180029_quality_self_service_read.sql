-- KRAVIA Office OS — quality self-service visibility.
-- Reporters can track their own nonconformances without receiving department-wide quality access.

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'quality.read','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do nothing;
