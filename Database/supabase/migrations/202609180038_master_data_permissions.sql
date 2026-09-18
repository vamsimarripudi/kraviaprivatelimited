-- KRAVIA Office OS — canonical product/customer master-data permissions.
-- Business objects remain owned by the existing FastAPI runtime; this migration only provides Office navigation/action authority.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('master.product.read','MASTER_DATA','READ_PRODUCT','Read products','Read canonical KRAVIA product master records.','STANDARD',false,false,true),
 ('master.product.create','MASTER_DATA','CREATE_PRODUCT','Create product','Create a canonical product through the governed FastAPI runtime.','HIGH',true,true,true),
 ('master.customer.read','MASTER_DATA','READ_CUSTOMER','Read customers','Read canonical customer identity records.','SENSITIVE',false,true,true),
 ('master.customer.create','MASTER_DATA','CREATE_CUSTOMER','Create customer','Create a canonical customer identity through the governed FastAPI runtime.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('PRODUCT_MANAGER','master.product.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','master.product.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','master.product.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','master.customer.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','master.customer.create','ALLOW','COMPANY'),
 ('SALES_MANAGER','master.customer.read','ALLOW','COMPANY'),
 ('SALES_USER','master.customer.read','ALLOW','COMPANY'),
 ('SUPPORT_MANAGER','master.customer.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','master.product.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','master.customer.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

-- Product creation is intentionally not assigned to a normal profile here.
-- OWNER retains default owner authority and the FastAPI runtime additionally requires OWNER for POST /products.
