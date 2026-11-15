-- Disposable PostgreSQL fixture to test CA_TAX profile delegation.
create table public.office_access_profile_catalog (
 code text primary key, active boolean not null
);
create table public.office_role_catalog (
 role text primary key, active boolean not null
);
create table public.office_permission_catalog (
 code text primary key, active boolean not null,
 high_risk boolean not null, requires_managed_device boolean not null
);
create table public.office_access_profile_permissions (
 profile_code text not null references public.office_access_profile_catalog(code),
 permission_code text not null references public.office_permission_catalog(code),
 effect text not null,
 default_scope_type text not null,
 primary key(profile_code,permission_code)
);
insert into public.office_access_profile_catalog values ('CA_TAX',true),('OWNER_CORE',true);
insert into public.office_role_catalog values ('CA',true),('OWNER',true);
insert into public.office_permission_catalog(code,active,high_risk,requires_managed_device) values
 ('tax.gst.prepare',true,true,true),
 ('tax.gst.approve',true,true,true),
 ('registration.manage',true,true,true),
 ('finance.bank.read',true,false,true),
 ('document.finance.create',true,true,true),
 ('document.instance.read',true,false,true),
 ('document.instance.review',true,true,true),
 ('document.render',true,true,true),
 ('finance.read',true,false,false),
 ('finance.payment.approve',true,true,true),
 ('access.profile.assign',true,true,true),
 ('tax.gst.sign',true,true,true);
insert into public.office_access_profile_permissions
 (profile_code,permission_code,effect,default_scope_type) values
 ('CA_TAX','finance.read','ALLOW','COMPANY'),
 ('CA_TAX','tax.gst.prepare','ALLOW','COMPANY'),
 ('OWNER_CORE','access.profile.assign','ALLOW','COMPANY');
