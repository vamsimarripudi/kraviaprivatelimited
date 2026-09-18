-- KRAVIA Finance — governed budget allocation, commitments, adjustments and actuals.
-- Approved budgets are not silently edited. Changes use independently reviewed adjustments.
-- Upstream modules may reserve budget through commitment references; this ledger never executes a bank payment.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('finance.budget.read','FINANCE','READ_BUDGET','Read budgets','Read approved/authorised budget, commitments and actuals.','SENSITIVE',false,true,true),
 ('finance.budget.manage','FINANCE','MANAGE_BUDGET','Manage budget drafts','Create cycles and draft allocations without independently approving own work.','CRITICAL',true,true,true),
 ('finance.budget.review','FINANCE','REVIEW_BUDGET','Review budgets','Independently approve/reject cycles, allocations and adjustments.','CRITICAL',true,true,true),
 ('finance.budget.commit','FINANCE','COMMIT_BUDGET','Reserve budget','Create/release approved-budget commitments for authorised department/company work.','HIGH',true,true,true),
 ('finance.budget.actual','FINANCE','RECORD_ACTUAL','Record budget actual','Record immutable actual-spend references and consume related commitments.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('FINANCE_MANAGER','finance.budget.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.budget.manage','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.budget.review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.budget.commit','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','finance.budget.actual','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','finance.budget.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','finance.budget.commit','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','finance.budget.read','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','finance.budget.commit','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','finance.budget.read','ALLOW','DEPARTMENT'),
 ('ENGINEERING_MANAGER','finance.budget.commit','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','finance.budget.read','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','finance.budget.commit','ALLOW','DEPARTMENT'),
 ('AUDITOR_READONLY','finance.budget.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_budget_cycle_seq;
create sequence if not exists public.office_budget_seq;
create sequence if not exists public.office_budget_commitment_seq;
create sequence if not exists public.office_budget_actual_seq;
create sequence if not exists public.office_budget_adjustment_seq;
grant usage,select on sequence public.office_budget_cycle_seq,public.office_budget_seq,public.office_budget_commitment_seq,public.office_budget_actual_seq,public.office_budget_adjustment_seq to service_role;

create table if not exists public.office_budget_cycles(
 id uuid primary key default gen_random_uuid(),
 cycle_code text not null unique default ('KR-BCY-'||lpad(nextval('public.office_budget_cycle_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 180),
 period_start date not null,
 period_end date not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','ACTIVE','CLOSED','REJECTED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(period_end>=period_start)
);

create table if not exists public.office_budgets(
 id uuid primary key default gen_random_uuid(),
 budget_code text not null unique default ('KR-BUD-'||lpad(nextval('public.office_budget_seq')::text,7,'0')),
 cycle_id uuid not null references public.office_budget_cycles(id) on delete restrict,
 scope_type text not null check(scope_type in ('COMPANY','DEPARTMENT','PRODUCT','PROJECT','COST_CENTER')),
 scope_key text,
 category text not null,
 currency text not null default 'INR' check(char_length(currency)=3),
 allocation_minor bigint not null check(allocation_minor>=0),
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','CLOSED','REJECTED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(cycle_id,scope_type,scope_key,category,currency),
 check((scope_type='COMPANY' and scope_key is null) or (scope_type<>'COMPANY' and scope_key is not null))
);
create index if not exists office_budgets_scope_idx on public.office_budgets(scope_type,scope_key,status,category);

create table if not exists public.office_budget_adjustments(
 id uuid primary key default gen_random_uuid(),
 adjustment_code text not null unique default ('KR-BADJ-'||lpad(nextval('public.office_budget_adjustment_seq')::text,7,'0')),
 budget_id uuid not null references public.office_budgets(id) on delete restrict,
 delta_minor bigint not null check(delta_minor<>0),
 reason text not null check(char_length(trim(reason))>=3),
 evidence_reference text,
 status text not null default 'REQUESTED' check(status in ('REQUESTED','APPROVED','REJECTED')),
 requested_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now()
);
create index if not exists office_budget_adjustments_budget_idx on public.office_budget_adjustments(budget_id,status,created_at desc);

create table if not exists public.office_budget_commitments(
 id uuid primary key default gen_random_uuid(),
 commitment_code text not null unique default ('KR-BCM-'||lpad(nextval('public.office_budget_commitment_seq')::text,8,'0')),
 budget_id uuid not null references public.office_budgets(id) on delete restrict,
 source_type text not null check(source_type in ('PROCUREMENT','TRAVEL','HIRING','SOFTWARE','PROJECT','CONTRACT','CARD','OTHER')),
 source_reference text not null,
 description text not null check(char_length(trim(description))>=3),
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(char_length(currency)=3),
 approval_reference text not null,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','RELEASED','CONVERTED','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 released_by uuid references public.office_identity_users(user_id) on delete restrict,
 released_at timestamptz,
 release_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(source_type,source_reference,budget_id)
);
create index if not exists office_budget_commitments_budget_idx on public.office_budget_commitments(budget_id,status,created_at desc);

create table if not exists public.office_budget_actuals(
 id uuid primary key default gen_random_uuid(),
 actual_code text not null unique default ('KR-BACT-'||lpad(nextval('public.office_budget_actual_seq')::text,8,'0')),
 budget_id uuid not null references public.office_budgets(id) on delete restrict,
 commitment_id uuid references public.office_budget_commitments(id) on delete restrict,
 source_type text not null,
 source_reference text not null,
 description text not null,
 amount_minor bigint not null check(amount_minor>0),
 currency text not null check(char_length(currency)=3),
 evidence_reference text not null,
 recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(source_type,source_reference,budget_id)
);
create index if not exists office_budget_actuals_budget_idx on public.office_budget_actuals(budget_id,recorded_at desc);

create table if not exists public.office_budget_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 cycle_id uuid references public.office_budget_cycles(id) on delete restrict,
 budget_id uuid references public.office_budgets(id) on delete restrict,
 adjustment_id uuid references public.office_budget_adjustments(id) on delete restrict,
 commitment_id uuid references public.office_budget_commitments(id) on delete restrict,
 actual_id uuid references public.office_budget_actuals(id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_budget_cycles enable row level security;
alter table public.office_budgets enable row level security;
alter table public.office_budget_adjustments enable row level security;
alter table public.office_budget_commitments enable row level security;
alter table public.office_budget_actuals enable row level security;
alter table public.office_budget_events enable row level security;
revoke all on public.office_budget_cycles,public.office_budgets,public.office_budget_adjustments,public.office_budget_commitments,public.office_budget_actuals,public.office_budget_events from public,anon,authenticated;
grant select,insert,update on public.office_budget_cycles,public.office_budgets,public.office_budget_adjustments,public.office_budget_commitments to service_role;
grant select,insert on public.office_budget_actuals,public.office_budget_events to service_role;

create or replace function public.office_budget_available(p_budget uuid)
returns bigint language sql stable set search_path='' as $$
 select greatest(
   b.allocation_minor
   + coalesce((select sum(a.delta_minor) from public.office_budget_adjustments a where a.budget_id=b.id and a.status='APPROVED'),0)
   - coalesce((select sum(c.amount_minor) from public.office_budget_commitments c where c.budget_id=b.id and c.status='ACTIVE'),0)
   - coalesce((select sum(x.amount_minor) from public.office_budget_actuals x where x.budget_id=b.id),0),
   0
 )
 from public.office_budgets b where b.id=p_budget and b.status='APPROVED'
$$;

create or replace function public.office_budget_cycle_create(p_actor uuid,p_title text,p_start date,p_end date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'finance.budget.manage','COMPANY',null,null) then raise exception 'Budget management permission is required'; end if;
 insert into public.office_budget_cycles(title,period_start,period_end,created_by) values(trim(p_title),p_start,p_end,p_actor) returning id into v_id;
 insert into public.office_budget_events(actor_user_id,cycle_id,event_type,new_status) values(p_actor,v_id,'BUDGET_CYCLE_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_budget_cycle_transition(p_actor uuid,p_cycle uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_budget_cycles%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into c from public.office_budget_cycles where id=p_cycle for update;
 if c.id is null then raise exception 'Budget cycle not found'; end if;
 review:=target in ('APPROVED','REJECTED','CLOSED');
 if review then
   if not public.office_effective_permission(p_actor,'finance.budget.review','COMPANY',null,null) then raise exception 'Independent budget review permission is required'; end if;
   if p_actor=c.created_by then raise exception 'Budget-cycle creator cannot independently review the same cycle'; end if;
 else
   if not public.office_effective_permission(p_actor,'finance.budget.manage','COMPANY',null,null) then raise exception 'Budget management permission is required'; end if;
 end if;
 if c.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft cycle must be submitted'; end if;
 if c.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted cycle must be approved or rejected'; end if;
 if c.status='APPROVED' and target not in ('ACTIVE','CLOSED') then raise exception 'Approved cycle must activate or close'; end if;
 if c.status='ACTIVE' and target<>'CLOSED' then raise exception 'Active cycle may only close'; end if;
 if c.status in ('CLOSED','REJECTED') then raise exception 'Finalized budget cycle cannot transition'; end if;
 update public.office_budget_cycles set status=target,reviewed_by=case when review then p_actor else reviewed_by end,reviewed_at=case when review then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=c.id;
 insert into public.office_budget_events(actor_user_id,cycle_id,event_type,previous_status,new_status,note) values(p_actor,c.id,'BUDGET_CYCLE_TRANSITION',c.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_budget_create(
 p_actor uuid,p_cycle uuid,p_scope_type text,p_scope_key text,p_category text,p_currency text,p_allocation bigint
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; c public.office_budget_cycles%rowtype; st text:=upper(trim(p_scope_type)); sk text:=upper(trim(coalesce(p_scope_key,'')));
begin
 if not public.office_effective_permission(p_actor,'finance.budget.manage','COMPANY',null,null) then raise exception 'Budget management permission is required'; end if;
 select * into c from public.office_budget_cycles where id=p_cycle and status in ('APPROVED','ACTIVE');
 if c.id is null then raise exception 'Approved/active budget cycle is required'; end if;
 if st='COMPANY' then sk:=null;
 elsif st not in ('DEPARTMENT','PRODUCT','PROJECT','COST_CENTER') or sk='' then raise exception 'Valid budget scope is required';
 end if;
 insert into public.office_budgets(cycle_id,scope_type,scope_key,category,currency,allocation_minor,created_by)
 values(c.id,st,sk,upper(trim(p_category)),upper(trim(p_currency)),p_allocation,p_actor) returning id into v_id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,event_type,new_status) values(p_actor,c.id,v_id,'BUDGET_CREATED','DRAFT');
 return v_id;
end; $$;

create or replace function public.office_budget_transition(p_actor uuid,p_budget uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare b public.office_budgets%rowtype; target text:=upper(trim(p_status)); review boolean;
begin
 select * into b from public.office_budgets where id=p_budget for update;
 if b.id is null then raise exception 'Budget not found'; end if;
 review:=target in ('APPROVED','REJECTED','CLOSED');
 if review then
   if not public.office_effective_permission(p_actor,'finance.budget.review','COMPANY',null,null) then raise exception 'Independent budget review permission is required'; end if;
   if p_actor=b.created_by then raise exception 'Budget creator cannot independently review the same allocation'; end if;
 else
   if not public.office_effective_permission(p_actor,'finance.budget.manage','COMPANY',null,null) then raise exception 'Budget management permission is required'; end if;
 end if;
 if b.status='DRAFT' and target<>'SUBMITTED' then raise exception 'Draft budget must be submitted'; end if;
 if b.status='SUBMITTED' and target not in ('APPROVED','REJECTED') then raise exception 'Submitted budget must be approved or rejected'; end if;
 if b.status='APPROVED' and target<>'CLOSED' then raise exception 'Approved budget may only be closed'; end if;
 if b.status in ('CLOSED','REJECTED') then raise exception 'Finalized budget cannot transition'; end if;
 if target='CLOSED' and exists(select 1 from public.office_budget_commitments where budget_id=b.id and status='ACTIVE') then raise exception 'Active commitments must be released or converted before budget closure'; end if;
 update public.office_budgets set status=target,reviewed_by=case when review then p_actor else reviewed_by end,reviewed_at=case when review then now() else reviewed_at end,review_note=coalesce(nullif(trim(coalesce(p_note,'')),''),review_note),updated_at=now() where id=b.id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,event_type,previous_status,new_status,note) values(p_actor,b.cycle_id,b.id,'BUDGET_TRANSITION',b.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_budget_adjustment_request(p_actor uuid,p_budget uuid,p_delta bigint,p_reason text,p_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.office_budgets%rowtype; v_id uuid;
begin
 select * into b from public.office_budgets where id=p_budget and status='APPROVED';
 if b.id is null then raise exception 'Approved budget is required'; end if;
 if not public.office_effective_permission(p_actor,'finance.budget.manage','COMPANY',null,null) then raise exception 'Budget management permission is required'; end if;
 insert into public.office_budget_adjustments(budget_id,delta_minor,reason,evidence_reference,requested_by)
 values(b.id,p_delta,trim(p_reason),nullif(trim(coalesce(p_evidence,'')),''),p_actor) returning id into v_id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,adjustment_id,event_type,new_status) values(p_actor,b.cycle_id,b.id,v_id,'BUDGET_ADJUSTMENT_REQUESTED','REQUESTED');
 return v_id;
end; $$;

create or replace function public.office_budget_adjustment_review(p_actor uuid,p_adjustment uuid,p_status text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_budget_adjustments%rowtype; b public.office_budgets%rowtype; target text:=upper(trim(p_status));
begin
 if not public.office_effective_permission(p_actor,'finance.budget.review','COMPANY',null,null) then raise exception 'Independent budget review permission is required'; end if;
 select * into a from public.office_budget_adjustments where id=p_adjustment for update;
 if a.id is null or a.status<>'REQUESTED' then raise exception 'Requested adjustment is required'; end if;
 if p_actor=a.requested_by then raise exception 'Adjustment requester cannot approve their own budget change'; end if;
 if target not in ('APPROVED','REJECTED') then raise exception 'Invalid adjustment decision'; end if;
 select * into b from public.office_budgets where id=a.budget_id;
 if target='APPROVED' and b.allocation_minor
   + coalesce((select sum(x.delta_minor) from public.office_budget_adjustments x where x.budget_id=b.id and x.status='APPROVED'),0)
   + a.delta_minor
   < coalesce((select sum(c.amount_minor) from public.office_budget_commitments c where c.budget_id=b.id and c.status='ACTIVE'),0)
     + coalesce((select sum(y.amount_minor) from public.office_budget_actuals y where y.budget_id=b.id),0)
 then raise exception 'Adjustment would reduce budget below committed/actual spend'; end if;
 update public.office_budget_adjustments set status=target,reviewed_by=p_actor,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'' ) where id=a.id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,adjustment_id,event_type,previous_status,new_status,note) values(p_actor,b.cycle_id,b.id,a.id,'BUDGET_ADJUSTMENT_REVIEW',a.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_budget_commit(
 p_actor uuid,p_budget uuid,p_source_type text,p_source_reference text,p_description text,p_amount bigint,p_currency text,p_approval_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.office_budgets%rowtype; v_id uuid; allowed boolean;
begin
 select * into b from public.office_budgets where id=p_budget and status='APPROVED' for update;
 if b.id is null then raise exception 'Approved budget is required'; end if;
 allowed:=public.office_effective_permission(p_actor,'finance.budget.commit','COMPANY',null,null)
   or (b.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'finance.budget.commit','DEPARTMENT',b.scope_key,null));
 if not allowed then raise exception 'Budget commitment permission is required for this scope'; end if;
 if upper(trim(p_currency))<>b.currency then raise exception 'Commitment currency must match budget currency'; end if;
 if nullif(trim(coalesce(p_approval_reference,'')),'') is null then raise exception 'Upstream approval reference is required'; end if;
 if p_amount>public.office_budget_available(b.id) then raise exception 'Insufficient available budget'; end if;
 insert into public.office_budget_commitments(budget_id,source_type,source_reference,description,amount_minor,currency,approval_reference,created_by)
 values(b.id,upper(trim(p_source_type)),trim(p_source_reference),trim(p_description),p_amount,b.currency,trim(p_approval_reference),p_actor) returning id into v_id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,commitment_id,event_type,new_status,metadata) values(p_actor,b.cycle_id,b.id,v_id,'BUDGET_COMMITTED','ACTIVE',jsonb_build_object('amount_minor',p_amount,'source_reference',trim(p_source_reference)));
 return v_id;
end; $$;

create or replace function public.office_budget_release_commitment(p_actor uuid,p_commitment uuid,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare c public.office_budget_commitments%rowtype; b public.office_budgets%rowtype; allowed boolean;
begin
 select * into c from public.office_budget_commitments where id=p_commitment for update;
 if c.id is null or c.status<>'ACTIVE' then raise exception 'Active budget commitment is required'; end if;
 select * into b from public.office_budgets where id=c.budget_id;
 allowed:=public.office_effective_permission(p_actor,'finance.budget.commit','COMPANY',null,null)
   or (b.scope_type='DEPARTMENT' and public.office_effective_permission(p_actor,'finance.budget.commit','DEPARTMENT',b.scope_key,null));
 if not allowed then raise exception 'Budget commitment permission is required for this scope'; end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Commitment release reason is required'; end if;
 update public.office_budget_commitments set status='RELEASED',released_by=p_actor,released_at=now(),release_reason=trim(p_reason),updated_at=now() where id=c.id;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,commitment_id,event_type,previous_status,new_status,note) values(p_actor,b.cycle_id,b.id,c.id,'BUDGET_COMMITMENT_RELEASED',c.status,'RELEASED',left(p_reason,2000));
 return 'RELEASED';
end; $$;

create or replace function public.office_budget_record_actual(
 p_actor uuid,p_budget uuid,p_commitment uuid,p_source_type text,p_source_reference text,p_description text,p_amount bigint,p_currency text,p_evidence text
) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.office_budgets%rowtype; c public.office_budget_commitments%rowtype; v_id uuid; capacity bigint;
begin
 if not public.office_effective_permission(p_actor,'finance.budget.actual','COMPANY',null,null) then raise exception 'Budget actual-record permission is required'; end if;
 select * into b from public.office_budgets where id=p_budget and status='APPROVED' for update;
 if b.id is null then raise exception 'Approved budget is required'; end if;
 if upper(trim(p_currency))<>b.currency then raise exception 'Actual currency must match budget currency'; end if;
 capacity:=public.office_budget_available(b.id);
 if p_commitment is not null then
   select * into c from public.office_budget_commitments where id=p_commitment and budget_id=b.id and status='ACTIVE' for update;
   if c.id is null then raise exception 'Active matching commitment is required'; end if;
   capacity:=capacity+c.amount_minor;
 end if;
 if p_amount>capacity then raise exception 'Actual spend exceeds available budget capacity'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Actual-spend evidence is required'; end if;
 insert into public.office_budget_actuals(budget_id,commitment_id,source_type,source_reference,description,amount_minor,currency,evidence_reference,recorded_by)
 values(b.id,p_commitment,upper(trim(p_source_type)),trim(p_source_reference),trim(p_description),p_amount,b.currency,trim(p_evidence),p_actor) returning id into v_id;
 if p_commitment is not null then update public.office_budget_commitments set status='CONVERTED',updated_at=now() where id=p_commitment; end if;
 insert into public.office_budget_events(actor_user_id,cycle_id,budget_id,commitment_id,actual_id,event_type,new_status,metadata) values(p_actor,b.cycle_id,b.id,p_commitment,v_id,'BUDGET_ACTUAL_RECORDED','POSTED',jsonb_build_object('amount_minor',p_amount,'source_reference',trim(p_source_reference)));
 return v_id;
end; $$;

revoke all on function public.office_budget_available(uuid) from public,anon,authenticated;
revoke all on function public.office_budget_cycle_create(uuid,text,date,date) from public,anon,authenticated;
revoke all on function public.office_budget_cycle_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_budget_create(uuid,uuid,text,text,text,text,bigint) from public,anon,authenticated;
revoke all on function public.office_budget_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_budget_adjustment_request(uuid,uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.office_budget_adjustment_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_budget_commit(uuid,uuid,text,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.office_budget_release_commitment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_budget_record_actual(uuid,uuid,uuid,text,text,text,bigint,text,text) from public,anon,authenticated;

grant execute on function public.office_budget_available(uuid) to service_role;
grant execute on function public.office_budget_cycle_create(uuid,text,date,date) to service_role;
grant execute on function public.office_budget_cycle_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_budget_create(uuid,uuid,text,text,text,text,bigint) to service_role;
grant execute on function public.office_budget_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_budget_adjustment_request(uuid,uuid,bigint,text,text) to service_role;
grant execute on function public.office_budget_adjustment_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_budget_commit(uuid,uuid,text,text,text,bigint,text,text) to service_role;
grant execute on function public.office_budget_release_commitment(uuid,uuid,text) to service_role;
grant execute on function public.office_budget_record_actual(uuid,uuid,uuid,text,text,text,bigint,text,text) to service_role;
