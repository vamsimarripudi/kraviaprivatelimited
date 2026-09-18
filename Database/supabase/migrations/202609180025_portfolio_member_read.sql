-- KRAVIA Office OS — least-privilege portfolio participant read.
-- Lets project participants see their assigned project context without receiving department-wide portfolio authority.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('portfolio.member.read','PORTFOLIO','READ_MEMBER_PROJECT','Read assigned project','Read project context only when the actor owns or is actively assigned to that project/workstream/milestone.','STANDARD',false,false,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'portfolio.member.read','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
