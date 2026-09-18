-- KRAVIA Finance — corporate card and spend-control registry.
-- This registry intentionally stores only masked/card-control metadata. Never PAN, CVV, PIN, magnetic stripe, cryptogram or issuer token.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('finance.card.read','FINANCE','READ_CARD','Read corporate cards','Read masked corporate-card metadata, limits and policy state.','SENSITIVE',false,true,true),
 ('finance.card.manage','FINANCE','MANAGE_CARD','Manage corporate cards','Create/freeze/assign masked corporate-card records without executing issuer-side actions.','CRITICAL',true,true,true),
 ('finance.card.review','FINANCE','REVIEW_CARD','Review card controls','Independently approve limit changes, activation/reissue or closeout controls.','CRITICAL',true,true,true),
 ('finance.card.spend.request','FINANCE','REQUEST_CARD_SPEND','Request card spend','Request a controlled spend envelope for an assigned corporate card.','STANDARD',false,false,true),
 ('finance.card.spend.review','FINANCE','REVIEW_CARD_SPEND','Review card spend','Approve/reject spend-envelope requests independently from requester.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('FINANCE_MANAGER','finance.card.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.card.manage','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.card.review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.card.spend.review','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','finance.card.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','finance.card.spend.review','ALLOW','DEPARTMENT'),
 ('AUDITOR_READONLY','finance.card.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'finance.card.read','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do nothing;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'finance.card.spend.request','ALLOW','OWN'
from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do nothing;

create sequence if not exists public.office_corporate_card_seq;
create sequence if not exists public.office_card_spend_request_seq;
grant usage,select on sequence public.office_corporate_card_seq,public.office_card_spend_request_seq to service_role;

create table if not exists public.office_corporate_cards(
 id uuid primary key default gen_random_uuid(),
 card_code text not null unique default ('KR-CARD-'||lpad(nextval('public.office_corporate_card_seq')::text,6,'0')),
 issuer_name text not null check(char_length(trim(issuer_name)) between 2 and 180),
 issuer_account_reference text,
 issuer_card_reference text,
 last4 char(4) not null check(last4 ~ '^[0-9]{4}$'),
 card_type text not null default 'PHYSICAL' check(card_type in ('PHYSICAL','VIRTUAL')),
 cardholder_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 department_code text,
 cost_center text,
 currency text not null default 'INR' check(char_length(currency)=3),
 per_transaction_limit_minor bigint check(per_transaction_limit_minor is null or per_transaction_limit_minor>=0),
 monthly_limit_minor bigint check(monthly_limit_minor is null or monthly_limit_minor>=0),
 allowed_merchant_categories jsonb not null default '[]'::jsonb check(jsonb_typeof(allowed_merchant_categories)='array'),
 online_allowed boolean not null default true,
 international_allowed boolean not null default false,
 atm_allowed boolean not null default false,
 valid_through_month smallint check(valid_through_month is null or valid_through_month between 1 and 12),
 valid_through_year smallint check(valid_through_year is null or valid_through_year between 2020 and 2200),
 status text not null default 'PENDING_REVIEW' check(status in ('PENDING_REVIEW','ACTIVE','FROZEN','REISSUE_PENDING','CLOSED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_corporate_cards_holder_idx on public.office_corporate_cards(cardholder_user_id,status);
create index if not exists office_corporate_cards_department_idx on public.office_corporate_cards(department_code,status);

create table if not exists public.office_card_spend_requests(
 id uuid primary key default gen_random_uuid(),
 request_code text not null unique default ('KR-CSP-'||lpad(nextval('public.office_card_spend_request_seq')::text,7,'0')),
 card_id uuid not null references public.office_corporate_cards(id) on delete restrict,
 requester_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 merchant_or_purpose text not null check(char_length(trim(merchant_or_purpose)) between 3 and 500),
 merchant_category text,
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(char_length(currency)=3),
 project_reference text,
 expense_reference text,
 needed_by timestamptz,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','REJECTED','USED','EXPIRED','CANCELLED')),
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 issuer_transaction_reference text,
 receipt_reference text,
 used_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_card_spend_requests_card_idx on public.office_card_spend_requests(card_id,status,needed_by);
create index if not exists office_card_spend_requests_requester_idx on public.office_card_spend_requests(requester_user_id,status,created_at desc);

create table if not exists public.office_card_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 card_id uuid references public.office_corporate_cards(id) on delete restrict,
 spend_request_id uuid references public.office_card_spend_requests(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_corporate_cards enable row level security;
alter table public.office_card_spend_requests enable row level security;
alter table public.office_card_events enable row level security;
revoke all on public.office_corporate_cards,public.office_card_spend_requests,public.office_card_events from public,anon,authenticated;
grant select,insert,update on public.office_corporate_cards,public.office_card_spend_requests to service_role;
grant select,insert on public.office_card_events to service_role;

create or replace function public.office_corporate_card_create(
 p_actor uuid,p_issuer text,p_account_reference text,p_card_reference text,p_last4 text,p_type text,p_holder uuid,p_department text,p_cost_center text,p_currency text,p_per_transaction bigint,p_monthly bigint,p_categories jsonb,p_online boolean,p_international boolean,p_atm boolean,p_month smallint,p_year smallint
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text;
begin
 if not public.office_effective_permission(p_actor,'finance.card.manage','COMPANY',null,null) then raise exception 'Corporate-card management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_holder and status='ACTIVE') then raise exception 'Active cardholder is required'; end if;
 select primary_department into dept from public.office_identity_users where user_id=p_holder;
 insert into public.office_corporate_cards(issuer_name,issuer_account_reference,issuer_card_reference,last4,card_type,cardholder_user_id,department_code,cost_center,currency,per_transaction_limit_minor,monthly_limit_minor,allowed_merchant_categories,online_allowed,international_allowed,atm_allowed,valid_through_month,valid_through_year,created_by)
 values(trim(p_issuer),nullif(trim(coalesce(p_account_reference,'')),''),nullif(trim(coalesce(p_card_reference,'')),''),trim(p_last4),upper(trim(p_type)),p_holder,coalesce(nullif(upper(trim(coalesce(p_department,''))),''),dept),nullif(trim(coalesce(p_cost_center,'')),''),upper(trim(p_currency)),p_per_transaction,p_monthly,coalesce(p_categories,'[]'::jsonb),coalesce(p_online,true),coalesce(p_international,false),coalesce(p_atm,false),p_month,p_year,p_actor)
 returning id into v_id;
 insert into public.office_card_events(actor_user_id,card_id,event_type,new_status,note) values(p_actor,v_id,'CARD_CREATED','PENDING_REVIEW','Issuer-side card provisioning must be evidenced separately; KRAVIA stores no card secret.');
 return v_id;
end; $$;

create or replace function public.office_corporate_card_review(
 p_actor uuid,p_card uuid,p_status text,p_per_transaction bigint,p_monthly bigint,p_categories jsonb,p_online boolean,p_international boolean,p_atm boolean,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_corporate_cards%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'finance.card.review','COMPANY',null,null) then raise exception 'Independent corporate-card review permission is required'; end if;
 select * into c from public.office_corporate_cards where id=p_card for update;
 if c.id is null then raise exception 'Corporate card not found'; end if;
 if p_actor=c.cardholder_user_id or p_actor=c.created_by then raise exception 'Cardholder/creator cannot independently review the same corporate card'; end if;
 if target not in ('ACTIVE','FROZEN','REISSUE_PENDING','CLOSED') then raise exception 'Invalid corporate-card status'; end if;
 if c.status='PENDING_REVIEW' and target<>'ACTIVE' then raise exception 'Pending card must be independently activated first'; end if;
 if c.status='CLOSED' then raise exception 'Closed card cannot be changed'; end if;
 if target='ACTIVE' and (p_per_transaction is null or p_monthly is null) then raise exception 'Approved card limits are required'; end if;
 update public.office_corporate_cards set status=target,per_transaction_limit_minor=coalesce(p_per_transaction,per_transaction_limit_minor),monthly_limit_minor=coalesce(p_monthly,monthly_limit_minor),allowed_merchant_categories=coalesce(p_categories,allowed_merchant_categories),online_allowed=coalesce(p_online,online_allowed),international_allowed=coalesce(p_international,international_allowed),atm_allowed=coalesce(p_atm,atm_allowed),reviewed_by=p_actor,reviewed_at=now(),review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=c.id;
 insert into public.office_card_events(actor_user_id,card_id,event_type,previous_status,new_status,note) values(p_actor,c.id,'CARD_REVIEW',c.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_card_spend_request(
 p_actor uuid,p_card uuid,p_purpose text,p_category text,p_amount bigint,p_currency text,p_project text,p_expense text,p_needed timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_corporate_cards%rowtype; v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'finance.card.spend.request','OWN',p_actor::text,null) then raise exception 'Corporate-card spend request permission is required'; end if;
 select * into c from public.office_corporate_cards where id=p_card and cardholder_user_id=p_actor and status='ACTIVE';
 if c.id is null then raise exception 'Active assigned corporate card is required'; end if;
 if upper(trim(p_currency))<>c.currency then raise exception 'Spend request currency must match card currency'; end if;
 if c.per_transaction_limit_minor is not null and p_amount>c.per_transaction_limit_minor then raise exception 'Requested amount exceeds card per-transaction limit'; end if;
 insert into public.office_card_spend_requests(card_id,requester_user_id,merchant_or_purpose,merchant_category,amount_minor,currency,project_reference,expense_reference,needed_by)
 values(c.id,p_actor,trim(p_purpose),nullif(trim(coalesce(p_category,'')),''),p_amount,c.currency,nullif(trim(coalesce(p_project,'')),''),nullif(trim(coalesce(p_expense,'')),''),p_needed) returning id into v_id;
 insert into public.office_card_events(actor_user_id,card_id,spend_request_id,event_type,new_status) values(p_actor,c.id,v_id,'CARD_SPEND_REQUESTED','REQUESTED');
 return v_id;
end; $$;

create or replace function public.office_card_spend_review(
 p_actor uuid,p_request uuid,p_status text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare r public.office_card_spend_requests%rowtype; c public.office_corporate_cards%rowtype; target text:=upper(trim(p_status)); dept text;
begin
 select * into r from public.office_card_spend_requests where id=p_request for update;
 if r.id is null or r.status<>'REQUESTED' then raise exception 'Requested card spend is required'; end if;
 select * into c from public.office_corporate_cards where id=r.card_id;
 dept:=c.department_code;
 if not public.office_effective_permission(p_actor,'finance.card.spend.review','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'finance.card.spend.review','DEPARTMENT',dept,null) then raise exception 'Card-spend review permission is required'; end if;
 if p_actor=r.requester_user_id then raise exception 'Requester cannot approve their own card spend'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid card-spend decision'; end if;
 update public.office_card_spend_requests set status=target,reviewer_user_id=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=r.id;
 insert into public.office_card_events(actor_user_id,card_id,spend_request_id,event_type,previous_status,new_status,note) values(p_actor,r.card_id,r.id,'CARD_SPEND_REVIEW',r.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_card_spend_mark_used(
 p_actor uuid,p_request uuid,p_transaction_reference text,p_receipt text
) returns text language plpgsql security definer set search_path='' as $$
declare r public.office_card_spend_requests%rowtype;
begin
 select * into r from public.office_card_spend_requests where id=p_request for update;
 if r.id is null or r.status<>'APPROVED' then raise exception 'Approved card-spend request is required'; end if;
 if p_actor<>r.requester_user_id then raise exception 'Only requester/cardholder may record this spend usage'; end if;
 if nullif(trim(coalesce(p_transaction_reference,'')),'') is null or nullif(trim(coalesce(p_receipt,'')),'') is null then raise exception 'Issuer transaction reference and receipt reference are required'; end if;
 update public.office_card_spend_requests set status='USED',issuer_transaction_reference=trim(p_transaction_reference),receipt_reference=trim(p_receipt),used_at=now(),updated_at=now() where id=r.id;
 insert into public.office_card_events(actor_user_id,card_id,spend_request_id,event_type,previous_status,new_status,note) values(p_actor,r.card_id,r.id,'CARD_SPEND_USED',r.status,'USED','Usage recorded from issuer reference and receipt; no card transaction was executed by KRAVIA.');
 return 'USED';
end; $$;

revoke all on function public.office_corporate_card_create(uuid,text,text,text,text,text,uuid,text,text,text,bigint,bigint,jsonb,boolean,boolean,boolean,smallint,smallint) from public,anon,authenticated;
revoke all on function public.office_corporate_card_review(uuid,uuid,text,bigint,bigint,jsonb,boolean,boolean,boolean,text) from public,anon,authenticated;
revoke all on function public.office_card_spend_request(uuid,uuid,text,text,bigint,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_card_spend_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_card_spend_mark_used(uuid,uuid,text,text) from public,anon,authenticated;

grant execute on function public.office_corporate_card_create(uuid,text,text,text,text,text,uuid,text,text,text,bigint,bigint,jsonb,boolean,boolean,boolean,smallint,smallint) to service_role;
grant execute on function public.office_corporate_card_review(uuid,uuid,text,bigint,bigint,jsonb,boolean,boolean,boolean,text) to service_role;
grant execute on function public.office_card_spend_request(uuid,uuid,text,text,bigint,text,text,text,timestamptz) to service_role;
grant execute on function public.office_card_spend_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_card_spend_mark_used(uuid,uuid,text,text) to service_role;
