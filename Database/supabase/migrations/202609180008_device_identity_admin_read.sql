-- Follow-up: delegated Office administrators managing credentials need company-scoped credential visibility.
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
values ('OFFICE_ADMIN','identity.card.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update
set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
