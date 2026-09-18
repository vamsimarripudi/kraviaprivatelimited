-- KRAVIA Office OS — corporate domain, DNS and certificate control.
-- No registrar credentials, DNS API keys, certificate private keys or raw secret values are stored here.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('infra.domain.read','INFRASTRUCTURE','READ_DOMAIN','Read domains','Read corporate domain and certificate metadata.','SENSITIVE',false,true,true),
 ('infra.domain.manage','INFRASTRUCTURE','MANAGE_DOMAIN','Manage domains','Create and maintain domain ownership, renewal and certificate metadata.','CRITICAL',true,true,true),
 ('infra.dns.propose','INFRASTRUCTURE','PROPOSE_DNS','Propose DNS change','Propose DNS changes using hashed expected values and provider references.','HIGH',true,true,true),
 ('infra.dns.review','INFRASTRUCTURE','REVIEW_DNS','Review DNS change','Independently approve or reject DNS changes.','CRITICAL',true,true,true),
 ('infra.dns.verify','INFRASTRUCTURE','VERIFY_DNS','Verify DNS change','Record provider application and independent verification evidence.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('DEVOPS_OPERATOR','infra.domain.read','ALLOW','COMPANY'),
 ('DEVOPS_OPERATOR','infra.domain.manage','ALLOW','COMPANY'),
 ('DEVOPS_OPERATOR','infra.dns.propose','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','infra.domain.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','infra.dns.review','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','infra.dns.verify','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','infra.domain.read','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','infra.domain.manage','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','infra.domain.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_domain_seq;
create sequence if not exists public.office_dns_change_seq;
create sequence if not exists public.office_certificate_seq;
grant usage,select on sequence public.office_domain_seq,public.office_dns_change_seq,public.office_certificate_seq to service_role;

create table if not exists public.office_corporate_domains(
 id uuid primary key default gen_random_uuid(),
 domain_code text not null unique default ('KR-DOM-'||lpad(nextval('public.office_domain_seq')::text,6,'0')),
 domain_name text not null unique,
 registrar_name text,
 dns_provider_name text,
 registered_on date,
 expires_on date,
 auto_renew boolean not null default false,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 renewal_reference text,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','TRANSFER_PENDING','EXPIRING','EXPIRED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_on is null or registered_on is null or expires_on>=registered_on)
);
create index if not exists office_corporate_domains_expiry_idx on public.office_corporate_domains(status,expires_on);

create table if not exists public.office_dns_changes(
 id uuid primary key default gen_random_uuid(),
 change_code text not null unique default ('KR-DNS-'||lpad(nextval('public.office_dns_change_seq')::text,7,'0')),
 domain_id uuid not null references public.office_corporate_domains(id) on delete restrict,
 record_name text not null,
 record_type text not null check(record_type in ('A','AAAA','CNAME','MX','TXT','SRV','CAA','NS','OTHER')),
 expected_value_sha256 text not null check(expected_value_sha256 ~ '^[0-9a-f]{64}$'),
 ttl_seconds integer check(ttl_seconds is null or ttl_seconds between 30 and 604800),
 provider_record_reference text,
 purpose text not null,
 status text not null default 'PROPOSED' check(status in ('PROPOSED','APPROVED','REJECTED','PROVIDER_APPLIED','VERIFIED','ROLLED_BACK','CANCELLED')),
 proposed_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 applied_by uuid references public.office_identity_users(user_id) on delete restrict,
 applied_at timestamptz,
 apply_evidence_reference text,
 verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 verified_at timestamptz,
 observed_value_sha256 text check(observed_value_sha256 is null or observed_value_sha256 ~ '^[0-9a-f]{64}$'),
 verification_evidence_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_dns_changes_domain_idx on public.office_dns_changes(domain_id,status,created_at desc);

create table if not exists public.office_tls_certificates(
 id uuid primary key default gen_random_uuid(),
 certificate_code text not null unique default ('KR-TLS-'||lpad(nextval('public.office_certificate_seq')::text,7,'0')),
 domain_id uuid not null references public.office_corporate_domains(id) on delete restrict,
 service_id uuid references public.office_engineering_services(id) on delete restrict,
 hostname_pattern text not null,
 issuer_name text not null,
 fingerprint_sha256 text not null check(fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
 provider_reference text,
 issued_at timestamptz,
 expires_at timestamptz not null,
 auto_managed boolean not null default true,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','EXPIRING','EXPIRED','REVOKED','REPLACED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists office_tls_certificate_fingerprint_idx on public.office_tls_certificates(fingerprint_sha256);
create index if not exists office_tls_certificate_expiry_idx on public.office_tls_certificates(status,expires_at);

create table if not exists public.office_domain_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 domain_id uuid references public.office_corporate_domains(id) on delete restrict,
 dns_change_id uuid references public.office_dns_changes(id) on delete restrict,
 certificate_id uuid references public.office_tls_certificates(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_corporate_domains enable row level security;
alter table public.office_dns_changes enable row level security;
alter table public.office_tls_certificates enable row level security;
alter table public.office_domain_events enable row level security;
revoke all on public.office_corporate_domains,public.office_dns_changes,public.office_tls_certificates,public.office_domain_events from public,anon,authenticated;
grant select,insert,update on public.office_corporate_domains,public.office_dns_changes,public.office_tls_certificates to service_role;
grant select,insert on public.office_domain_events to service_role;

create or replace function public.office_domain_create(
 p_actor uuid,p_domain text,p_registrar text,p_dns_provider text,p_registered date,p_expires date,p_auto_renew boolean,p_owner uuid,p_renewal_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; d text:=lower(trim(p_domain));
begin
 if not public.office_effective_permission(p_actor,'infra.domain.manage','COMPANY',null,null) then raise exception 'Domain management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active domain owner is required'; end if;
 if d !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then raise exception 'Valid corporate domain name is required'; end if;
 insert into public.office_corporate_domains(domain_name,registrar_name,dns_provider_name,registered_on,expires_on,auto_renew,owner_user_id,renewal_reference,created_by)
 values(d,nullif(trim(coalesce(p_registrar,'')),''),nullif(trim(coalesce(p_dns_provider,'')),''),p_registered,p_expires,coalesce(p_auto_renew,false),p_owner,nullif(trim(coalesce(p_renewal_reference,'')),''),p_actor)
 returning id into v_id;
 insert into public.office_domain_events(actor_user_id,domain_id,event_type,new_status,metadata) values(p_actor,v_id,'DOMAIN_CREATED','ACTIVE',jsonb_build_object('domain_name',d));
 return v_id;
end; $$;

create or replace function public.office_domain_update(
 p_actor uuid,p_domain uuid,p_registrar text,p_dns_provider text,p_expires date,p_auto_renew boolean,p_owner uuid,p_renewal_reference text,p_status text
) returns text language plpgsql security definer set search_path='' as $$
declare d public.office_corporate_domains%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'infra.domain.manage','COMPANY',null,null) then raise exception 'Domain management permission is required'; end if;
 select * into d from public.office_corporate_domains where id=p_domain for update;
 if d.id is null then raise exception 'Domain not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active domain owner is required'; end if;
 if target not in ('ACTIVE','TRANSFER_PENDING','EXPIRING','EXPIRED','RETIRED') then raise exception 'Invalid domain status'; end if;
 update public.office_corporate_domains set registrar_name=nullif(trim(coalesce(p_registrar,'')),''),dns_provider_name=nullif(trim(coalesce(p_dns_provider,'')),''),expires_on=p_expires,auto_renew=coalesce(p_auto_renew,false),owner_user_id=p_owner,renewal_reference=nullif(trim(coalesce(p_renewal_reference,'')),''),status=target,updated_at=now() where id=d.id;
 insert into public.office_domain_events(actor_user_id,domain_id,event_type,previous_status,new_status) values(p_actor,d.id,'DOMAIN_UPDATED',d.status,target);
 return target;
end; $$;

create or replace function public.office_dns_change_propose(
 p_actor uuid,p_domain uuid,p_record_name text,p_record_type text,p_expected_sha256 text,p_ttl integer,p_provider_reference text,p_purpose text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; hash text:=lower(trim(p_expected_sha256));
begin
 if not public.office_effective_permission(p_actor,'infra.dns.propose','COMPANY',null,null) then raise exception 'DNS change proposal permission is required'; end if;
 if not exists(select 1 from public.office_corporate_domains where id=p_domain and status in ('ACTIVE','EXPIRING','TRANSFER_PENDING')) then raise exception 'Active corporate domain is required'; end if;
 if hash !~ '^[0-9a-f]{64}$' then raise exception 'Expected DNS value must be represented by a SHA-256 hex hash'; end if;
 insert into public.office_dns_changes(domain_id,record_name,record_type,expected_value_sha256,ttl_seconds,provider_record_reference,purpose,proposed_by)
 values(p_domain,trim(p_record_name),upper(trim(p_record_type)),hash,p_ttl,nullif(trim(coalesce(p_provider_reference,'')),''),trim(p_purpose),p_actor) returning id into v_id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,new_status) values(p_actor,p_domain,v_id,'DNS_CHANGE_PROPOSED','PROPOSED');
 return v_id;
end; $$;

create or replace function public.office_dns_change_review(
 p_actor uuid,p_change uuid,p_status text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_dns_changes%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'infra.dns.review','COMPANY',null,null) then raise exception 'Independent DNS review permission is required'; end if;
 select * into c from public.office_dns_changes where id=p_change for update;
 if c.id is null or c.status<>'PROPOSED' then raise exception 'Proposed DNS change is required'; end if;
 if p_actor=c.proposed_by then raise exception 'DNS change proposer cannot independently approve the same change'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid DNS review decision'; end if;
 update public.office_dns_changes set status=target,approved_by=p_actor,approved_at=now(),updated_at=now() where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,previous_status,new_status,note) values(p_actor,c.domain_id,c.id,'DNS_CHANGE_REVIEW',c.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_dns_change_mark_applied(
 p_actor uuid,p_change uuid,p_apply_evidence text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_dns_changes%rowtype;
begin
 if not public.office_effective_permission(p_actor,'infra.dns.propose','COMPANY',null,null) then raise exception 'DNS change execution-record permission is required'; end if;
 select * into c from public.office_dns_changes where id=p_change for update;
 if c.id is null or c.status<>'APPROVED' then raise exception 'Approved DNS change is required'; end if;
 if nullif(trim(coalesce(p_apply_evidence,'')),'') is null then raise exception 'Provider application evidence is required'; end if;
 update public.office_dns_changes set status='PROVIDER_APPLIED',applied_by=p_actor,applied_at=now(),apply_evidence_reference=trim(p_apply_evidence),updated_at=now() where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,previous_status,new_status) values(p_actor,c.domain_id,c.id,'DNS_CHANGE_MARKED_APPLIED',c.status,'PROVIDER_APPLIED');
 return 'PROVIDER_APPLIED';
end; $$;

create or replace function public.office_dns_change_verify(
 p_actor uuid,p_change uuid,p_observed_sha256 text,p_evidence text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_dns_changes%rowtype; observed text:=lower(trim(p_observed_sha256));
begin
 if not public.office_effective_permission(p_actor,'infra.dns.verify','COMPANY',null,null) then raise exception 'Independent DNS verification permission is required'; end if;
 select * into c from public.office_dns_changes where id=p_change for update;
 if c.id is null or c.status<>'PROVIDER_APPLIED' then raise exception 'Provider-applied DNS change is required'; end if;
 if p_actor=c.proposed_by or p_actor=c.applied_by then raise exception 'DNS proposer/executor cannot independently verify the same change'; end if;
 if observed !~ '^[0-9a-f]{64}$' then raise exception 'Observed DNS value must be represented by SHA-256 hex hash'; end if;
 if observed<>c.expected_value_sha256 then raise exception 'Observed DNS hash does not match approved expected value'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'DNS verification evidence is required'; end if;
 update public.office_dns_changes set status='VERIFIED',verified_by=p_actor,verified_at=now(),observed_value_sha256=observed,verification_evidence_reference=trim(p_evidence),updated_at=now() where id=c.id;
 insert into public.office_domain_events(actor_user_id,domain_id,dns_change_id,event_type,previous_status,new_status) values(p_actor,c.domain_id,c.id,'DNS_CHANGE_VERIFIED',c.status,'VERIFIED');
 return 'VERIFIED';
end; $$;

create or replace function public.office_tls_certificate_record(
 p_actor uuid,p_domain uuid,p_service uuid,p_hostname text,p_issuer text,p_fingerprint text,p_provider_reference text,p_issued timestamptz,p_expires timestamptz,p_auto boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; fp text:=lower(replace(trim(p_fingerprint),':',''));
begin
 if not public.office_effective_permission(p_actor,'infra.domain.manage','COMPANY',null,null) then raise exception 'Domain management permission is required'; end if;
 if not exists(select 1 from public.office_corporate_domains where id=p_domain) then raise exception 'Domain not found'; end if;
 if p_service is not null and not exists(select 1 from public.office_engineering_services where id=p_service) then raise exception 'Engineering service not found'; end if;
 if fp !~ '^[0-9a-f]{64}$' then raise exception 'Certificate fingerprint must be SHA-256 hex'; end if;
 if p_expires<=coalesce(p_issued,'1970-01-01'::timestamptz) then raise exception 'Certificate expiry must follow issuance'; end if;
 insert into public.office_tls_certificates(domain_id,service_id,hostname_pattern,issuer_name,fingerprint_sha256,provider_reference,issued_at,expires_at,auto_managed,created_by)
 values(p_domain,p_service,trim(p_hostname),trim(p_issuer),fp,nullif(trim(coalesce(p_provider_reference,'')),''),p_issued,p_expires,coalesce(p_auto,true),p_actor)
 returning id into v_id;
 insert into public.office_domain_events(actor_user_id,domain_id,certificate_id,event_type,new_status) values(p_actor,p_domain,v_id,'TLS_CERTIFICATE_RECORDED','ACTIVE');
 return v_id;
end; $$;

revoke all on function public.office_domain_create(uuid,text,text,text,date,date,boolean,uuid,text) from public,anon,authenticated;
revoke all on function public.office_domain_update(uuid,uuid,text,text,date,boolean,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_dns_change_propose(uuid,uuid,text,text,text,integer,text,text) from public,anon,authenticated;
revoke all on function public.office_dns_change_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_dns_change_mark_applied(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_dns_change_verify(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_tls_certificate_record(uuid,uuid,uuid,text,text,text,text,timestamptz,timestamptz,boolean) from public,anon,authenticated;

grant execute on function public.office_domain_create(uuid,text,text,text,date,date,boolean,uuid,text) to service_role;
grant execute on function public.office_domain_update(uuid,uuid,text,text,date,boolean,uuid,text,text) to service_role;
grant execute on function public.office_dns_change_propose(uuid,uuid,text,text,text,integer,text,text) to service_role;
grant execute on function public.office_dns_change_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_dns_change_mark_applied(uuid,uuid,text) to service_role;
grant execute on function public.office_dns_change_verify(uuid,uuid,text,text) to service_role;
grant execute on function public.office_tls_certificate_record(uuid,uuid,uuid,text,text,text,text,timestamptz,timestamptz,boolean) to service_role;
