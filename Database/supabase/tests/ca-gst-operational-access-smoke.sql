-- Test that CA TAX grants cover filing and records, not Owner or signing.
do $verify$
declare expected_count integer; granted_count integer;
begin
 select count(*) into expected_count from (
  values ('tax.gst.approve'),('registration.manage'),('finance.bank.read'),
   ('document.finance.create'),('document.instance.read'),
   ('document.instance.review'),('document.render')
 ) as expected(permission_code);
 select count(*) into granted_count from public.office_access_profile_permissions
 where profile_code='CA_TAX' and effect='ALLOW' and default_scope_type='COMPANY'
 and permission_code in ('tax.gst.approve','registration.manage','finance.bank.read',
  'document.finance.create','document.instance.read','document.instance.review','document.render');
 if granted_count<>expected_count then
  raise exception 'CA GST scope not installed: % of % required',granted_count,expected_count;
 end if;
 if exists(
  select 1 from public.office_access_profile_permissions where profile_code='CA_TAX'
  and permission_code in ('finance.payment.approve','access.profile.assign','tax.gst.sign')
 ) then raise exception 'CA received bank payment, identity, or signatory authority'; end if;
 if not exists(select 1 from public.office_access_profile_permissions where profile_code='CA_TAX'
  and permission_code='tax.gst.prepare' and effect='ALLOW') then
  raise exception 'Existing CA preparation capability lost'; end if;
 if (select count(*) from public.office_access_profile_permissions where profile_code='CA_TAX')<>9
 then raise exception 'CA TAX granted unexpected permissions'; end if;
 if (select count(*) from public.office_access_profile_permissions where profile_code='OWNER_CORE')<>1
 then raise exception 'Other access profiles were altered'; end if;
 if not exists(select 1 from public.office_permission_catalog where
  code='tax.gst.approve' and high_risk=true and requires_managed_device=true)
 then raise exception 'Managed device requirement lost'; end if;
end $verify$;
select 'CA_GST_OPERATIONAL_PROFILE_VERIFIED' as result;
