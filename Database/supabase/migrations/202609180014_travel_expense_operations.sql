-- KRAVIA Office OS — travel and employee expense operations.
-- Travel approval and reimbursement evidence remain separate from bank execution/accounting posting.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('travel.read','TRAVEL','READ','Read travel','Read own or authorised travel requests and claims.','STANDARD',false,false,true),
 ('travel.request','TRAVEL','REQUEST','Request travel','Submit own business travel request.','STANDARD',false,false,true),
 ('travel.manager_review','TRAVEL','MANAGER_REVIEW','Review travel business purpose','Approve/reject travel business purpose within managed scope.','HIGH',true,true,true),
 ('travel.finance_review','TRAVEL','FINANCE_REVIEW','Review travel budget','Approve/reject estimated travel spend after business approval.','CRITICAL',true,true,true),
 ('travel.book','TRAVEL','BOOK','Record travel booking','Record booking evidence after approved travel; does not grant bank authority.','HIGH',true,true,true),
 ('travel.claim.submit','TRAVEL','CLAIM_SUBMIT','Submit travel claim','Submit own receipt-backed travel expense claim.','STANDARD',false,false,true),
 ('travel.claim.review','TRAVEL','CLAIM_REVIEW','Review travel claim','Approve/reject travel claims and close them with a finance payment reference.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'travel.read','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'travel.request','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'travel.claim.submit','ALLOW','OWN' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OPERATIONS_MANAGER','travel.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','travel.manager_review','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','travel.book','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','travel.read','ALLOW','COMPANY'),
 ('HR_MANAGER','travel.manager_review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','travel.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','travel.finance_review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','travel.claim.review','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','travel.read','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','travel.book','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','travel.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_travel_seq;
create sequence if not exists public.office_travel_claim_seq;
grant usage,select on sequence public.office_travel_seq,public.office_travel_claim_seq to service_role;

create table if not exists public.office_travel_requests(
 id uuid primary key default gen_random_uuid(),
 travel_code text not null unique default ('KR-TRV-'||lpad(nextval('public.office_travel_seq')::text,6,'0')),
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 purpose text not null check(char_length(trim(purpose))>=3),
 destination text not null check(char_length(trim(destination))>=2),
 starts_on date not null,
 ends_on date not null,
 estimated_amount_paise bigint not null check(estimated_amount_paise>=0),
 currency text not null default 'INR' check(char_length(currency)=3),
 project_reference text,
 cost_center text,
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','MANAGER_APPROVED','FINANCE_APPROVED','BOOKED','IN_TRIP','COMPLETED','REJECTED','CANCELLED')),
 manager_reviewer uuid references public.office_identity_users(user_id) on delete restrict,
 manager_reviewed_at timestamptz,
 manager_note text,
 finance_reviewer uuid references public.office_identity_users(user_id) on delete restrict,
 finance_reviewed_at timestamptz,
 finance_note text,
 booking_reference text,
 booking_evidence_reference text,
 booked_by uuid references public.office_identity_users(user_id) on delete restrict,
 booked_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(ends_on>=starts_on)
);
create index if not exists office_travel_requester_idx on public.office_travel_requests(requester_user_id,status,starts_on);
create index if not exists office_travel_department_idx on public.office_travel_requests(department_code,status,starts_on);

create table if not exists public.office_travel_claims(
 id uuid primary key default gen_random_uuid(),
 claim_code text not null unique default ('KR-CLM-'||lpad(nextval('public.office_travel_claim_seq')::text,6,'0')),
 travel_id uuid not null references public.office_travel_requests(id) on delete restrict,
 claimant_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 expense_date date not null,
 category text not null check(category in ('TRANSPORT','LODGING','MEALS','LOCAL_TRAVEL','VISA','COMMUNICATION','OTHER')),
 description text not null check(char_length(trim(description))>=3),
 amount_paise bigint not null check(amount_paise>0),
 currency text not null default 'INR' check(char_length(currency)=3),
 receipt_reference text not null check(char_length(trim(receipt_reference))>=3),
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','APPROVED','REJECTED','PAID')),
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 finance_payment_reference text,
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_travel_claim_user_idx on public.office_travel_claims(claimant_user_id,status,expense_date);
create index if not exists office_travel_claim_trip_idx on public.office_travel_claims(travel_id,status,expense_date);

create table if not exists public.office_travel_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 travel_id uuid references public.office_travel_requests(id) on delete restrict,
 claim_id uuid references public.office_travel_claims(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_travel_requests enable row level security;
alter table public.office_travel_claims enable row level security;
alter table public.office_travel_events enable row level security;
revoke all on public.office_travel_requests,public.office_travel_claims,public.office_travel_events from public,anon,authenticated;
grant select,insert,update on public.office_travel_requests,public.office_travel_claims to service_role;
grant select,insert on public.office_travel_events to service_role;

create or replace function public.office_travel_request_create(p_actor uuid,p_purpose text,p_destination text,p_start date,p_end date,p_estimate bigint,p_currency text,p_project text,p_cost_center text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text;
begin
 if not public.office_effective_permission(p_actor,'travel.request','OWN',p_actor::text,null) then raise exception 'Travel request permission is required'; end if;
 select primary_department into dept from public.office_identity_users where user_id=p_actor and status='ACTIVE';
 if p_end<p_start then raise exception 'Travel end date cannot precede start date'; end if;
 insert into public.office_travel_requests(requester_user_id,department_code,purpose,destination,starts_on,ends_on,estimated_amount_paise,currency,project_reference,cost_center)
 values(p_actor,dept,trim(p_purpose),trim(p_destination),p_start,p_end,p_estimate,upper(trim(p_currency)),nullif(trim(coalesce(p_project,'')),''),nullif(trim(coalesce(p_cost_center,'')),'')) returning id into v_id;
 insert into public.office_travel_events(actor_user_id,travel_id,event_type,new_status) values(p_actor,v_id,'TRAVEL_SUBMITTED','SUBMITTED');
 return v_id;
end; $$;

create or replace function public.office_travel_manager_review(p_actor uuid,p_travel uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_travel_requests%rowtype; target text:=upper(trim(p_decision));
begin
 select * into r from public.office_travel_requests where id=p_travel for update;
 if r.id is null or r.status<>'SUBMITTED' then raise exception 'Submitted travel request is required'; end if;
 if p_actor=r.requester_user_id then raise exception 'Requester cannot approve their own travel'; end if;
 if not public.office_effective_permission(p_actor,'travel.manager_review','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'travel.manager_review','DEPARTMENT',r.department_code,null) then raise exception 'Travel manager-review permission is required'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid manager decision'; end if;
 update public.office_travel_requests set status=case when target='APPROVED' then 'MANAGER_APPROVED' else 'REJECTED' end,manager_reviewer=p_actor,manager_reviewed_at=now(),manager_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=r.id;
 insert into public.office_travel_events(actor_user_id,travel_id,event_type,previous_status,new_status,note) values(p_actor,r.id,'MANAGER_REVIEW',r.status,case when target='APPROVED' then 'MANAGER_APPROVED' else 'REJECTED' end,left(p_note,2000));
 return case when target='APPROVED' then 'MANAGER_APPROVED' else 'REJECTED' end;
end; $$;

create or replace function public.office_travel_finance_review(p_actor uuid,p_travel uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_travel_requests%rowtype; target text:=upper(trim(p_decision));
begin
 select * into r from public.office_travel_requests where id=p_travel for update;
 if r.id is null or r.status<>'MANAGER_APPROVED' then raise exception 'Manager-approved travel request is required'; end if;
 if p_actor=r.requester_user_id or p_actor=r.manager_reviewer then raise exception 'Requester/manager reviewer cannot perform finance review for the same travel request'; end if;
 if not public.office_effective_permission(p_actor,'travel.finance_review','COMPANY',null,null) then raise exception 'Travel finance-review permission is required'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid finance decision'; end if;
 update public.office_travel_requests set status=case when target='APPROVED' then 'FINANCE_APPROVED' else 'REJECTED' end,finance_reviewer=p_actor,finance_reviewed_at=now(),finance_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=r.id;
 insert into public.office_travel_events(actor_user_id,travel_id,event_type,previous_status,new_status,note) values(p_actor,r.id,'FINANCE_REVIEW',r.status,case when target='APPROVED' then 'FINANCE_APPROVED' else 'REJECTED' end,left(p_note,2000));
 return case when target='APPROVED' then 'FINANCE_APPROVED' else 'REJECTED' end;
end; $$;

create or replace function public.office_travel_book(p_actor uuid,p_travel uuid,p_reference text,p_evidence text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_travel_requests%rowtype;
begin
 select * into r from public.office_travel_requests where id=p_travel for update;
 if r.id is null or r.status<>'FINANCE_APPROVED' then raise exception 'Finance-approved travel request is required'; end if;
 if not public.office_effective_permission(p_actor,'travel.book','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'travel.book','DEPARTMENT',r.department_code,null) then raise exception 'Travel booking permission is required'; end if;
 if nullif(trim(coalesce(p_reference,'')),'') is null or nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Booking reference and evidence are required'; end if;
 update public.office_travel_requests set status='BOOKED',booking_reference=trim(p_reference),booking_evidence_reference=trim(p_evidence),booked_by=p_actor,booked_at=now(),updated_at=now() where id=r.id;
 insert into public.office_travel_events(actor_user_id,travel_id,event_type,previous_status,new_status,metadata) values(p_actor,r.id,'TRAVEL_BOOKED',r.status,'BOOKED',jsonb_build_object('booking_reference',trim(p_reference),'evidence_reference',trim(p_evidence)));
 return 'BOOKED';
end; $$;

create or replace function public.office_travel_self_transition(p_actor uuid,p_travel uuid,p_status text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_travel_requests%rowtype; target text:=upper(trim(p_status));
begin
 select * into r from public.office_travel_requests where id=p_travel for update;
 if r.id is null or r.requester_user_id<>p_actor then raise exception 'Own travel request is required'; end if;
 if target='IN_TRIP' and r.status<>'BOOKED' then raise exception 'Booked travel is required to start trip'; end if;
 if target='COMPLETED' and r.status not in ('BOOKED','IN_TRIP') then raise exception 'Booked/in-trip travel is required to complete trip'; end if;
 if target='CANCELLED' and r.status not in ('SUBMITTED','MANAGER_APPROVED','FINANCE_APPROVED') then raise exception 'Current travel state cannot be cancelled by requester'; end if;
 if target not in ('IN_TRIP','COMPLETED','CANCELLED') then raise exception 'Invalid requester travel transition'; end if;
 update public.office_travel_requests set status=target,completed_at=case when target='COMPLETED' then now() else completed_at end,updated_at=now() where id=r.id;
 insert into public.office_travel_events(actor_user_id,travel_id,event_type,previous_status,new_status) values(p_actor,r.id,'TRAVEL_UPDATED',r.status,target);
 return target;
end; $$;

create or replace function public.office_travel_claim_submit(p_actor uuid,p_travel uuid,p_date date,p_category text,p_description text,p_amount bigint,p_currency text,p_receipt text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_travel_requests%rowtype; v_id uuid;
begin
 select * into r from public.office_travel_requests where id=p_travel;
 if r.id is null or r.requester_user_id<>p_actor or r.status not in ('BOOKED','IN_TRIP','COMPLETED') then raise exception 'Own approved/booked travel request is required'; end if;
 if not public.office_effective_permission(p_actor,'travel.claim.submit','OWN',p_actor::text,null) then raise exception 'Travel claim permission is required'; end if;
 if nullif(trim(coalesce(p_receipt,'')),'') is null then raise exception 'Receipt reference is required'; end if;
 insert into public.office_travel_claims(travel_id,claimant_user_id,expense_date,category,description,amount_paise,currency,receipt_reference)
 values(r.id,p_actor,p_date,upper(trim(p_category)),trim(p_description),p_amount,upper(trim(p_currency)),trim(p_receipt)) returning id into v_id;
 insert into public.office_travel_events(actor_user_id,travel_id,claim_id,event_type,new_status,metadata) values(p_actor,r.id,v_id,'CLAIM_SUBMITTED','SUBMITTED',jsonb_build_object('amount_paise',p_amount,'currency',upper(trim(p_currency))));
 return v_id;
end; $$;

create or replace function public.office_travel_claim_review(p_actor uuid,p_claim uuid,p_status text,p_note text,p_payment_reference text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_travel_claims%rowtype; target text:=upper(trim(p_status));
begin
 select * into c from public.office_travel_claims where id=p_claim for update;
 if c.id is null then raise exception 'Travel claim not found'; end if;
 if p_actor=c.claimant_user_id then raise exception 'Claimant cannot review their own travel claim'; end if;
 if not public.office_effective_permission(p_actor,'travel.claim.review','COMPANY',null,null) then raise exception 'Travel claim review permission is required'; end if;
 if c.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted claim must be approved or rejected'; end if;
 if c.status='APPROVED' and target<>'PAID' then raise exception 'Approved claim may only be marked paid'; end if;
 if c.status in ('REJECTED','PAID') then raise exception 'Finalized travel claim cannot be transitioned'; end if;
 if target='PAID' and nullif(trim(coalesce(p_payment_reference,'')),'') is null then raise exception 'Finance payment reference is required to close reimbursement'; end if;
 update public.office_travel_claims set status=target,reviewer_user_id=p_actor,reviewed_at=case when target in ('APPROVED','REJECTED') then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),finance_payment_reference=case when target='PAID' then trim(p_payment_reference) else finance_payment_reference end,paid_at=case when target='PAID' then now() else paid_at end,updated_at=now() where id=c.id;
 insert into public.office_travel_events(actor_user_id,travel_id,claim_id,event_type,previous_status,new_status,note,metadata) values(p_actor,c.travel_id,c.id,'CLAIM_UPDATED',c.status,target,left(p_note,2000),jsonb_build_object('finance_payment_reference',case when target='PAID' then trim(p_payment_reference) else null end));
 return target;
end; $$;

revoke all on function public.office_travel_request_create(uuid,text,text,date,date,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.office_travel_manager_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_travel_finance_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_travel_book(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_travel_self_transition(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_travel_claim_submit(uuid,uuid,date,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.office_travel_claim_review(uuid,uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.office_travel_request_create(uuid,text,text,date,date,bigint,text,text,text) to service_role;
grant execute on function public.office_travel_manager_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_travel_finance_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_travel_book(uuid,uuid,text,text) to service_role;
grant execute on function public.office_travel_self_transition(uuid,uuid,text) to service_role;
grant execute on function public.office_travel_claim_submit(uuid,uuid,date,text,text,bigint,text,text) to service_role;
grant execute on function public.office_travel_claim_review(uuid,uuid,text,text,text) to service_role;
