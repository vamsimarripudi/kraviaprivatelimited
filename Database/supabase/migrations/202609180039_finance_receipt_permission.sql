-- KRAVIA Finance — explicit incoming-receipt authority.
-- This permission records an already-received external payment against an invoice.
-- It does not initiate an outbound bank/card payment.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('finance.receipt.record','FINANCE','RECORD_RECEIPT','Record received payment','Record externally received customer payment evidence against an issued invoice and generate the canonical receipt.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('FINANCE_MANAGER','finance.receipt.record','ALLOW','COMPANY'),
 ('ACCOUNTANT','finance.receipt.record','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
