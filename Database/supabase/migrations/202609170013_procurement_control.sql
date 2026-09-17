-- Controlled procurement and renewal workflow. Approval does not execute payment.
-- Vendor master/payment/bank records remain separate systems of record.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('operations.procurement.read','OPERATIONS','READ_PROCUREMENT','Read procurement','Read purchase requests, comparisons, purchase orders and renewals in assigned scope.','STANDARD',false,false,true),
 ('operations.procurement.prepare','OPERATIONS','PREPARE_PROCUREMENT','Prepare procurement','Prepare purchase requests, quotes and vendor comparisons without approving own spend.','HIGH',false,false,true),
 ('operations.po.issue','OPERATIONS','ISSUE_PO','Issue approved purchase order','Issue a PO only after the linked purchase request is independently approved.','HIGH',true,true,true),
 ('operations.receipt.record','OPERATIONS','RECORD_RECEIPT','Record receipt/acceptance','Record goods/service receipt evidence without releasing payment.','HIGH',false,false,true),
 ('operations.renewal.manage','OPERATIONS','MANAGE_RENEWAL','Manage SaaS renewals','Track company software/service renewals and initiate controlled renewal requests.','HIGH',false,false,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('PROCUREMENT_USER','operations.procurement.read','ALLOW','DEPARTMENT'),
 ('PROCUREMENT_USER','operations.procurement.prepare','ALLOW','DEPARTMENT'),
 ('PROCUREMENT_USER','operations.renewal.manage','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','operations.procurement.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','operations.procurement.prepare','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','operations.po.issue','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','operations.receipt.record','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','operations.renewal.manage','ALLOW','DEPARTMENT'),
 ('FINANCE_MANAGER','operations.procurement.read','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','operations.procurement.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_procurement_request_seq;
create sequence if not exists public.office_purchase_order_seq;
create sequence if not exists public.office_procurement_receipt_seq;
create sequence if not exists public.office_renewal_seq;
grant usage on sequence public.office_procurement_request_seq,public.office_purchase_order_seq,public.office_procurement_receipt_seq,public.office_renewal_seq to service_role;

create table if not exists public.office_procurement_requests(
 id uuid primary key default gen_random_uuid(),
 request_code text not null unique default ('KR-PR-'||lpad(nextval('public.office_procurement_request_seq')::text,6,'0')),
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 category text not null default 'OTHER' check(category in ('SOFTWARE','CLOUD','HARDWARE','PROFESSIONAL_SERVICE','OFFICE','TRAVEL','MARKETING','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 business_need text not null check(char_length(trim(business_need))>=3),
 quantity numeric(14,3) not null default 1 check(quantity>0),
 estimated_amount_minor bigint not null check(estimated_amount_minor>=0),
 currency text not null check(char_length(currency)=3),
 required_by date,
 budget_reference text,
 preferred_vendor_reference text,
 preferred_vendor_name text,
 risk_note text,
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','PO_ISSUED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 selected_quote_id uuid,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 updated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_procurement_requests_owner_idx on public.office_procurement_requests(owner_user_id,status,required_by);
create index if not exists office_procurement_requests_department_idx on public.office_procurement_requests(department_code,status);

create table if not exists public.office_procurement_quotes(
 id uuid primary key default gen_random_uuid(),
 procurement_request_id uuid not null references public.office_procurement_requests(id) on delete cascade,
 vendor_reference text,
 vendor_name text not null check(char_length(trim(vendor_name))>=2),
 quoted_amount_minor bigint not null check(quoted_amount_minor>=0),
 currency text not null check(char_length(currency)=3),
 tax_note text,
 commercial_terms text,
 validity_until date,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 comparison_note text,
 selected boolean not null default false,
 recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists office_procurement_one_selected_quote_idx on public.office_procurement_quotes(procurement_request_id) where selected=true;

alter table public.office_procurement_requests drop constraint if exists office_procurement_requests_selected_quote_id_fkey;
alter table public.office_procurement_requests add constraint office_procurement_requests_selected_quote_id_fkey foreign key(selected_quote_id) references public.office_procurement_quotes(id) on delete restrict;

create table if not exists public.office_purchase_orders(
 id uuid primary key default gen_random_uuid(),
 po_code text not null unique default ('KR-PO-'||lpad(nextval('public.office_purchase_order_seq')::text,6,'0')),
 procurement_request_id uuid not null unique references public.office_procurement_requests(id) on delete restrict,
 approval_request_id uuid not null references public.office_requests(id) on delete restrict,
 selected_quote_id uuid references public.office_procurement_quotes(id) on delete restrict,
 vendor_reference text,
 vendor_name text not null,
 amount_minor bigint not null check(amount_minor>=0),
 currency text not null check(char_length(currency)=3),
 tax_note text,
 terms text,
 issue_reference text not null check(char_length(trim(issue_reference))>=3),
 status text not null default 'ISSUED' check(status in ('ISSUED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
 issued_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 issued_at timestamptz not null default now(),
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_procurement_receipts(
 id uuid primary key default gen_random_uuid(),
 receipt_code text not null unique default ('KR-GR-'||lpad(nextval('public.office_procurement_receipt_seq')::text,6,'0')),
 purchase_order_id uuid not null references public.office_purchase_orders(id) on delete restrict,
 acceptance_status text not null check(acceptance_status in ('PARTIAL','ACCEPTED','REJECTED')),
 quantity_received numeric(14,3) check(quantity_received is null or quantity_received>=0),
 service_period text,
 evidence_reference text not null check(char_length(trim(evidence_reference))>=3),
 note text,
 recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 recorded_at timestamptz not null default now()
);

create table if not exists public.office_vendor_renewals(
 id uuid primary key default gen_random_uuid(),
 renewal_code text not null unique default ('KR-RNW-'||lpad(nextval('public.office_renewal_seq')::text,6,'0')),
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 vendor_reference text,
 vendor_name text not null,
 service_name text not null,
 service_category text not null default 'SOFTWARE' check(service_category in ('SOFTWARE','CLOUD','DOMAIN','EMAIL','SECURITY','PROFESSIONAL_SERVICE','OTHER')),
 renewal_at timestamptz not null,
 notice_at timestamptz,
 expected_amount_minor bigint check(expected_amount_minor is null or expected_amount_minor>=0),
 currency text check(currency is null or char_length(currency)=3),
 auto_renew boolean not null default false,
 contract_reference text,
 status text not null default 'TRACKED' check(status in ('TRACKED','REVIEW_REQUIRED','RENEWAL_REQUESTED','RENEWED','CANCEL_SCHEDULED','CANCELLED','EXPIRED')),
 procurement_request_id uuid references public.office_procurement_requests(id) on delete restrict,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_vendor_renewals_due_idx on public.office_vendor_renewals(status,renewal_at);

create table if not exists public.office_procurement_events(
 id bigint generated always as identity primary key,
 procurement_request_id uuid references public.office_procurement_requests(id) on delete cascade,
 purchase_order_id uuid references public.office_purchase_orders(id) on delete cascade,
 renewal_id uuid references public.office_vendor_renewals(id) on delete cascade,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_procurement_requests enable row level security;
alter table public.office_procurement_quotes enable row level security;
alter table public.office_purchase_orders enable row level security;
alter table public.office_procurement_receipts enable row level security;
alter table public.office_vendor_renewals enable row level security;
alter table public.office_procurement_events enable row level security;
revoke all on public.office_procurement_requests,public.office_procurement_quotes,public.office_purchase_orders,public.office_procurement_receipts,public.office_vendor_renewals,public.office_procurement_events from anon,authenticated;
grant select,insert,update on public.office_procurement_requests,public.office_procurement_quotes,public.office_purchase_orders,public.office_vendor_renewals to service_role;
grant select,insert on public.office_procurement_receipts,public.office_procurement_events to service_role;

create or replace function public.office_procurement_create(
 p_actor uuid,p_owner uuid,p_department text,p_category text,p_title text,p_need text,p_quantity numeric,p_amount bigint,p_currency text,p_required_by date,p_budget text,p_vendor_ref text,p_vendor_name text,p_risk text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'operations.procurement.prepare','DEPARTMENT',p_department,null)
    and not public.office_effective_permission(p_actor,'operations.procurement.prepare','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'operations.purchase.request','DEPARTMENT',p_department,null)
    and not public.office_effective_permission(p_actor,'operations.purchase.request','COMPANY',null,null) then raise exception 'Procurement preparation permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active procurement owner is required'; end if;
 insert into public.office_procurement_requests(requester_user_id,owner_user_id,department_code,category,title,business_need,quantity,estimated_amount_minor,currency,required_by,budget_reference,preferred_vendor_reference,preferred_vendor_name,risk_note,created_by,updated_by)
 values(p_actor,p_owner,nullif(trim(coalesce(p_department,'')),''),upper(trim(p_category)),trim(p_title),trim(p_need),coalesce(p_quantity,1),p_amount,upper(trim(p_currency)),p_required_by,nullif(trim(coalesce(p_budget,'')),''),nullif(trim(coalesce(p_vendor_ref,'')),''),nullif(trim(coalesce(p_vendor_name,'')),''),nullif(trim(coalesce(p_risk,'')),''),p_actor,p_actor) returning id into v_id;
 insert into public.office_procurement_events(procurement_request_id,actor_user_id,event_type,new_status) values(v_id,p_actor,'PROCUREMENT_DRAFT_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_procurement_add_quote(p_actor uuid,p_request uuid,p_vendor_ref text,p_vendor_name text,p_amount bigint,p_currency text,p_tax_note text,p_terms text,p_validity date,p_source text,p_comparison text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_procurement_requests%rowtype; v_id uuid;
begin
 select * into r from public.office_procurement_requests where id=p_request for update;
 if r.id is null or r.status not in ('DRAFT','REJECTED') then raise exception 'Procurement request is not editable'; end if;
 if p_actor<>r.requester_user_id and p_actor<>r.owner_user_id and not public.office_effective_permission(p_actor,'operations.procurement.prepare','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.procurement.prepare','COMPANY',null,null) then raise exception 'Procurement preparation permission is required'; end if;
 insert into public.office_procurement_quotes(procurement_request_id,vendor_reference,vendor_name,quoted_amount_minor,currency,tax_note,commercial_terms,validity_until,source_reference,comparison_note,recorded_by)
 values(p_request,nullif(trim(coalesce(p_vendor_ref,'')),''),trim(p_vendor_name),p_amount,upper(trim(p_currency)),nullif(trim(coalesce(p_tax_note,'')),''),nullif(trim(coalesce(p_terms,'')),''),p_validity,trim(p_source),nullif(trim(coalesce(p_comparison,'')),''),p_actor) returning id into v_id;
 insert into public.office_procurement_events(procurement_request_id,actor_user_id,event_type,metadata) values(p_request,p_actor,'QUOTE_RECORDED',jsonb_build_object('quote_id',v_id,'vendor_name',trim(p_vendor_name),'amount_minor',p_amount,'currency',upper(trim(p_currency))));
 return v_id;
end; $$;

create or replace function public.office_procurement_select_quote(p_actor uuid,p_request uuid,p_quote uuid,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_procurement_requests%rowtype; q public.office_procurement_quotes%rowtype;
begin
 select * into r from public.office_procurement_requests where id=p_request for update;
 if r.id is null or r.status not in ('DRAFT','REJECTED') then raise exception 'Procurement request is not editable'; end if;
 if p_actor<>r.owner_user_id and not public.office_effective_permission(p_actor,'operations.procurement.prepare','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.procurement.prepare','COMPANY',null,null) then raise exception 'Procurement preparation permission is required'; end if;
 select * into q from public.office_procurement_quotes where id=p_quote and procurement_request_id=p_request;
 if q.id is null then raise exception 'Quote does not belong to procurement request'; end if;
 update public.office_procurement_quotes set selected=false,updated_at=now() where procurement_request_id=p_request;
 update public.office_procurement_quotes set selected=true,comparison_note=coalesce(nullif(trim(coalesce(p_note,'')),''),comparison_note),updated_at=now() where id=p_quote;
 update public.office_procurement_requests set selected_quote_id=p_quote,preferred_vendor_reference=q.vendor_reference,preferred_vendor_name=q.vendor_name,estimated_amount_minor=q.quoted_amount_minor,currency=q.currency,updated_by=p_actor,updated_at=now() where id=p_request;
 insert into public.office_procurement_events(procurement_request_id,actor_user_id,event_type,metadata) values(p_request,p_actor,'QUOTE_SELECTED',jsonb_build_object('quote_id',p_quote,'selection_note',nullif(trim(coalesce(p_note,'')),'')));
 return p_quote;
end; $$;

create or replace function public.office_procurement_submit(p_actor uuid,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_procurement_requests%rowtype; approval uuid; payload jsonb;
begin
 select * into r from public.office_procurement_requests where id=p_request for update;
 if r.id is null or r.status not in ('DRAFT','REJECTED') then raise exception 'Procurement request is not submittable'; end if;
 if p_actor<>r.requester_user_id and p_actor<>r.owner_user_id then raise exception 'Requester or owner must submit procurement request'; end if;
 if r.selected_quote_id is null and r.estimated_amount_minor>0 then raise exception 'Select a quote or approved sourcing basis before submission'; end if;
 payload:=jsonb_build_object('procurement_request_id',r.id,'request_code',r.request_code,'category',r.category,'estimated_amount_minor',r.estimated_amount_minor,'currency',r.currency,'preferred_vendor_name',r.preferred_vendor_name,'budget_reference',r.budget_reference,'required_by',r.required_by);
 approval:=public.office_create_request(p_actor,'PURCHASE','Purchase approval · '||r.request_code,r.title||' — '||r.business_need,payload,'NORMAL',null,'DEPARTMENT',r.department_code);
 update public.office_procurement_requests set status='PENDING_APPROVAL',approval_request_id=approval,updated_by=p_actor,updated_at=now() where id=p_request;
 insert into public.office_procurement_events(procurement_request_id,actor_user_id,event_type,previous_status,new_status,metadata) values(p_request,p_actor,'PROCUREMENT_SUBMITTED',r.status,'PENDING_APPROVAL',jsonb_build_object('approval_request_id',approval));
 return approval;
end; $$;

create or replace function public.office_procurement_sync_approval(p_actor uuid,p_request uuid)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_procurement_requests%rowtype; a public.office_requests%rowtype; new_state text;
begin
 select * into r from public.office_procurement_requests where id=p_request for update;
 if r.id is null or r.approval_request_id is null then raise exception 'Procurement approval request is missing'; end if;
 if p_actor<>r.owner_user_id and p_actor<>r.requester_user_id and not public.office_effective_permission(p_actor,'operations.procurement.read','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.procurement.read','COMPANY',null,null) then raise exception 'Procurement read permission is required'; end if;
 select * into a from public.office_requests where id=r.approval_request_id;
 if a.id is null then raise exception 'Approval workflow record not found'; end if;
 new_state:=case when a.status='APPROVED' then 'APPROVED' when a.status='REJECTED' then 'REJECTED' when a.status in ('CANCELLED','EXPIRED') then 'CANCELLED' else 'PENDING_APPROVAL' end;
 if r.status<>new_state and r.status not in ('PO_ISSUED','PARTIALLY_RECEIVED','RECEIVED','CLOSED') then
  update public.office_procurement_requests set status=new_state,updated_by=p_actor,updated_at=now() where id=p_request;
  insert into public.office_procurement_events(procurement_request_id,actor_user_id,event_type,previous_status,new_status,metadata) values(p_request,p_actor,'APPROVAL_SYNCED',r.status,new_state,jsonb_build_object('workflow_status',a.status));
 end if;
 return new_state;
end; $$;

create or replace function public.office_procurement_issue_po(p_actor uuid,p_request uuid,p_issue_reference text,p_terms text,p_tax_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_procurement_requests%rowtype; a public.office_requests%rowtype; q public.office_procurement_quotes%rowtype; v_id uuid;
begin
 select * into r from public.office_procurement_requests where id=p_request for update;
 if r.id is null or r.approval_request_id is null then raise exception 'Approved procurement request is required'; end if;
 select * into a from public.office_requests where id=r.approval_request_id;
 if a.status<>'APPROVED' then raise exception 'Independent purchase approval is not complete'; end if;
 if p_actor=r.requester_user_id then raise exception 'Requester cannot issue the purchase order for their own request'; end if;
 if not public.office_effective_permission(p_actor,'operations.po.issue','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.po.issue','COMPANY',null,null) and not public.office_effective_permission(p_actor,'operations.purchase.approve','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.purchase.approve','COMPANY',null,null) then raise exception 'PO issue permission is required'; end if;
 if r.selected_quote_id is not null then select * into q from public.office_procurement_quotes where id=r.selected_quote_id; end if;
 insert into public.office_purchase_orders(procurement_request_id,approval_request_id,selected_quote_id,vendor_reference,vendor_name,amount_minor,currency,tax_note,terms,issue_reference,issued_by)
 values(r.id,r.approval_request_id,r.selected_quote_id,coalesce(q.vendor_reference,r.preferred_vendor_reference),coalesce(q.vendor_name,r.preferred_vendor_name,'Unspecified vendor'),coalesce(q.quoted_amount_minor,r.estimated_amount_minor),coalesce(q.currency,r.currency),nullif(trim(coalesce(p_tax_note,'')),''),nullif(trim(coalesce(p_terms,'')),''),trim(p_issue_reference),p_actor) returning id into v_id;
 update public.office_procurement_requests set status='PO_ISSUED',updated_by=p_actor,updated_at=now() where id=p_request;
 insert into public.office_procurement_events(procurement_request_id,purchase_order_id,actor_user_id,event_type,previous_status,new_status,metadata) values(p_request,v_id,p_actor,'PURCHASE_ORDER_ISSUED',r.status,'PO_ISSUED',jsonb_build_object('issue_reference',trim(p_issue_reference)));
 return v_id;
end; $$;

create or replace function public.office_procurement_record_receipt(p_actor uuid,p_po uuid,p_status text,p_quantity numeric,p_service_period text,p_evidence text,p_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare po public.office_purchase_orders%rowtype; r public.office_procurement_requests%rowtype; v_id uuid; acceptance text:=upper(trim(p_status)); new_state text;
begin
 select * into po from public.office_purchase_orders where id=p_po for update;
 if po.id is null or po.status in ('CANCELLED','CLOSED') then raise exception 'Purchase order is unavailable for receipt'; end if;
 select * into r from public.office_procurement_requests where id=po.procurement_request_id for update;
 if not public.office_effective_permission(p_actor,'operations.receipt.record','DEPARTMENT',r.department_code,null) and not public.office_effective_permission(p_actor,'operations.receipt.record','COMPANY',null,null) then raise exception 'Receipt recording permission is required'; end if;
 if acceptance not in ('PARTIAL','ACCEPTED','REJECTED') then raise exception 'Invalid receipt status'; end if;
 insert into public.office_procurement_receipts(purchase_order_id,acceptance_status,quantity_received,service_period,evidence_reference,note,recorded_by) values(p_po,acceptance,p_quantity,nullif(trim(coalesce(p_service_period,'')),''),trim(p_evidence),nullif(trim(coalesce(p_note,'')),''),p_actor) returning id into v_id;
 new_state:=case when acceptance='PARTIAL' then 'PARTIALLY_RECEIVED' when acceptance='ACCEPTED' then 'RECEIVED' else po.status end;
 if acceptance<>'REJECTED' then update public.office_purchase_orders set status=new_state,updated_at=now() where id=p_po; update public.office_procurement_requests set status=new_state,updated_by=p_actor,updated_at=now() where id=r.id; end if;
 insert into public.office_procurement_events(procurement_request_id,purchase_order_id,actor_user_id,event_type,previous_status,new_status,metadata) values(r.id,p_po,p_actor,'RECEIPT_RECORDED',po.status,new_state,jsonb_build_object('receipt_id',v_id,'acceptance_status',acceptance,'evidence_reference',trim(p_evidence)));
 return v_id;
end; $$;

create or replace function public.office_renewal_create(p_actor uuid,p_owner uuid,p_department text,p_vendor_ref text,p_vendor_name text,p_service text,p_category text,p_renewal_at timestamptz,p_notice_at timestamptz,p_amount bigint,p_currency text,p_auto boolean,p_contract_ref text,p_source text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'operations.renewal.manage','DEPARTMENT',p_department,null) and not public.office_effective_permission(p_actor,'operations.renewal.manage','COMPANY',null,null) then raise exception 'Renewal management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active renewal owner is required'; end if;
 insert into public.office_vendor_renewals(owner_user_id,department_code,vendor_reference,vendor_name,service_name,service_category,renewal_at,notice_at,expected_amount_minor,currency,auto_renew,contract_reference,source_reference,created_by)
 values(p_owner,nullif(trim(coalesce(p_department,'')),''),nullif(trim(coalesce(p_vendor_ref,'')),''),trim(p_vendor_name),trim(p_service),upper(trim(p_category)),p_renewal_at,p_notice_at,p_amount,case when p_currency is null then null else upper(trim(p_currency)) end,coalesce(p_auto,false),nullif(trim(coalesce(p_contract_ref,'')),''),trim(p_source),p_actor) returning id into v_id;
 insert into public.office_procurement_events(renewal_id,actor_user_id,event_type,new_status) values(v_id,p_actor,'RENEWAL_TRACKED','TRACKED');
 return v_id;
end; $$;

revoke all on function public.office_procurement_create(uuid,uuid,text,text,text,text,numeric,bigint,text,date,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_procurement_add_quote(uuid,uuid,text,text,bigint,text,text,text,date,text,text) from public,anon,authenticated;
revoke all on function public.office_procurement_select_quote(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_procurement_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_procurement_sync_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_procurement_issue_po(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_procurement_record_receipt(uuid,uuid,text,numeric,text,text,text) from public,anon,authenticated;
revoke all on function public.office_renewal_create(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,bigint,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.office_procurement_create(uuid,uuid,text,text,text,text,numeric,bigint,text,date,text,text,text,text) to service_role;
grant execute on function public.office_procurement_add_quote(uuid,uuid,text,text,bigint,text,text,text,date,text,text) to service_role;
grant execute on function public.office_procurement_select_quote(uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_procurement_submit(uuid,uuid) to service_role;
grant execute on function public.office_procurement_sync_approval(uuid,uuid) to service_role;
grant execute on function public.office_procurement_issue_po(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_procurement_record_receipt(uuid,uuid,text,numeric,text,text,text) to service_role;
grant execute on function public.office_renewal_create(uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,bigint,text,boolean,text,text) to service_role;
