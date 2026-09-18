-- KRAVIA Office OS — domain/DNS/certificate lifecycle hardening.
-- Technical evidence is preserved through state transitions; secret values and private keys remain out of this schema.

create or replace function public.office_dns_change_cancel(
 p_actor uuid,p_change uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.office_dns_changes%rowtype;
begin
 select * into c from public.office_dns_changes where id=p_change for update;
 if c.id is null or c.status not in ('PROPOSED','APPROVED') then raise exception 'Pending DNS change is required'; end if;
 if p_actor<>c.proposed_by and not public.office_effective_permission(p_actor,'infra.dns.propose','COMPANY',null,null) then
  raise exception 'DNS proposal authority is required';
 end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Cancellation reason is required'; end if;
 update public.office_dns_changes set status='CANCELLED',updated_at=now() where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,previous_status,new_status,note)
 values(p_actor,c.domain_id,c.id,'DNS_CHANGE_CANCELLED',c.status,'CANCELLED',left(p_reason,2000));
 return true;
end; $$;

create or replace function public.office_dns_change_rollback(
 p_actor uuid,p_change uuid,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_dns_changes%rowtype;
begin
 if not public.office_effective_permission(p_actor,'infra.dns.propose','COMPANY',null,null) then
  raise exception 'DNS execution-record permission is required';
 end if;
 select * into c from public.office_dns_changes where id=p_change for update;
 if c.id is null or c.status not in ('PROVIDER_APPLIED','VERIFIED') then raise exception 'Applied or verified DNS change is required'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Rollback evidence is required'; end if;
 update public.office_dns_changes
 set status='ROLLED_BACK',apply_evidence_reference=coalesce(apply_evidence_reference,trim(p_evidence)),updated_at=now()
 where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,previous_status,new_status,note,metadata)
 values(p_actor,c.domain_id,c.id,'DNS_CHANGE_ROLLED_BACK',c.status,'ROLLED_BACK',left(p_note,2000),jsonb_build_object('rollback_evidence_reference',trim(p_evidence)));
 return 'ROLLED_BACK';
end; $$;

create or replace function public.office_tls_certificate_transition(
 p_actor uuid,p_certificate uuid,p_status text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_tls_certificates%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'infra.domain.manage','COMPANY',null,null) then
  raise exception 'Domain management permission is required';
 end if;
 select * into c from public.office_tls_certificates where id=p_certificate for update;
 if c.id is null then raise exception 'Certificate record not found'; end if;
 if target not in ('EXPIRING','EXPIRED','REVOKED','REPLACED') then raise exception 'Invalid certificate lifecycle status'; end if;
 if c.status in ('REVOKED','REPLACED') then raise exception 'Finalized certificate record cannot be transitioned'; end if;
 if target in ('REVOKED','REPLACED') and nullif(trim(coalesce(p_evidence,'')),'') is null then
  raise exception 'Certificate lifecycle evidence is required';
 end if;
 update public.office_tls_certificates set status=target,updated_at=now() where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,certificate_id,event_type,previous_status,new_status,note,metadata)
 values(p_actor,c.domain_id,c.id,'TLS_CERTIFICATE_TRANSITION',c.status,target,left(p_note,2000),jsonb_build_object('evidence_reference',nullif(trim(coalesce(p_evidence,'')),'') ));
 return target;
end; $$;

revoke all on function public.office_dns_change_cancel(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_dns_change_rollback(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_tls_certificate_transition(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.office_dns_change_cancel(uuid,uuid,text) to service_role;
grant execute on function public.office_dns_change_rollback(uuid,uuid,text,text) to service_role;
grant execute on function public.office_tls_certificate_transition(uuid,uuid,text,text,text) to service_role;
