-- KRAVIA Office OS — governed CRM pipeline.
-- Apply after Office identity/access governance. Browser clients never receive direct table privileges.

create sequence if not exists public.office_crm_lead_seq start with 1 increment by 1;
create sequence if not exists public.office_crm_opportunity_seq start with 1 increment by 1;

create table if not exists public.office_crm_leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique default ('KR-L-' || lpad(nextval('public.office_crm_lead_seq')::text,6,'0')),
  account_name text not null check (char_length(account_name) between 2 and 180),
  contact_name text,
  contact_email text,
  contact_phone text,
  source text not null default 'OTHER',
  stage text not null default 'NEW' check (stage in ('NEW','QUALIFIED','DISQUALIFIED','CONVERTED')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  estimated_value_minor bigint check (estimated_value_minor is null or estimated_value_minor>=0),
  currency text not null default 'INR' check (char_length(currency)=3),
  country text,
  notes text check (notes is null or char_length(notes)<=4000),
  converted_customer_id varchar,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_crm_leads_stage_owner_idx on public.office_crm_leads(stage,owner_user_id,created_at desc);

create table if not exists public.office_crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_code text not null unique default ('KR-O-' || lpad(nextval('public.office_crm_opportunity_seq')::text,6,'0')),
  lead_id uuid references public.office_crm_leads(id) on delete set null,
  customer_id varchar,
  product_id varchar,
  title text not null check (char_length(title) between 3 and 180),
  stage text not null default 'QUALIFICATION' check (stage in ('QUALIFICATION','DISCOVERY','DEMO','PROPOSAL','NEGOTIATION','CONTRACTING','WON','LOST')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  value_minor bigint check (value_minor is null or value_minor>=0),
  currency text not null default 'INR' check (char_length(currency)=3),
  expected_close_date date,
  next_step text check (next_step is null or char_length(next_step)<=1000),
  lost_reason text check (lost_reason is null or char_length(lost_reason)<=1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists office_crm_opportunities_stage_owner_idx on public.office_crm_opportunities(stage,owner_user_id,updated_at desc);
create index if not exists office_crm_opportunities_customer_idx on public.office_crm_opportunities(customer_id) where customer_id is not null;

create table if not exists public.office_crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.office_crm_leads(id) on delete restrict,
  opportunity_id uuid references public.office_crm_opportunities(id) on delete restrict,
  activity_type text not null check (activity_type in ('NOTE','CALL','EMAIL','MEETING','DEMO','PROPOSAL','FOLLOW_UP','SYSTEM')),
  subject text not null check (char_length(subject) between 2 and 180),
  body text check (body is null or char_length(body)<=4000),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (lead_id is not null or opportunity_id is not null)
);
create index if not exists office_crm_activities_lead_idx on public.office_crm_activities(lead_id,occurred_at desc);
create index if not exists office_crm_activities_opportunity_idx on public.office_crm_activities(opportunity_id,occurred_at desc);

create table if not exists public.office_crm_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (entity_type in ('LEAD','OPPORTUNITY')),
  entity_id uuid not null,
  action text not null,
  previous_state jsonb,
  new_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.office_crm_leads enable row level security;
alter table public.office_crm_opportunities enable row level security;
alter table public.office_crm_activities enable row level security;
alter table public.office_crm_audit enable row level security;
revoke all on public.office_crm_leads,public.office_crm_opportunities,public.office_crm_activities,public.office_crm_audit from anon,authenticated,public;
do $$ declare t text; begin foreach t in array array['office_crm_leads','office_crm_opportunities','office_crm_activities','office_crm_audit'] loop execute format('drop policy if exists %I on public.%I',t||'_deny_client_access',t); execute format('create policy %I on public.%I as restrictive for all to anon,authenticated using(false) with check(false)',t||'_deny_client_access',t); end loop; end $$;

create or replace function public.office_crm_touch() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists office_crm_leads_touch on public.office_crm_leads;
create trigger office_crm_leads_touch before update on public.office_crm_leads for each row execute function public.office_crm_touch();
drop trigger if exists office_crm_opportunities_touch on public.office_crm_opportunities;
create trigger office_crm_opportunities_touch before update on public.office_crm_opportunities for each row execute function public.office_crm_touch();

create or replace function public.office_crm_audit_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'KRAVIA Office CRM audit is immutable'; end; $$;
drop trigger if exists office_crm_audit_guard on public.office_crm_audit;
create trigger office_crm_audit_guard before update or delete on public.office_crm_audit for each row execute function public.office_crm_audit_immutable();

create or replace function public.office_crm_create_lead(p_actor uuid,p_owner uuid,p_account text,p_contact text,p_email text,p_phone text,p_source text,p_value bigint,p_currency text,p_country text,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_state jsonb;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Actor is not active'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Owner is not active'; end if;
  insert into public.office_crm_leads(account_name,contact_name,contact_email,contact_phone,source,owner_user_id,estimated_value_minor,currency,country,notes,created_by)
  values(trim(p_account),nullif(trim(coalesce(p_contact,'')),''),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_phone,'')),''),upper(coalesce(nullif(trim(p_source),''),'OTHER')),p_owner,p_value,upper(p_currency),nullif(trim(coalesce(p_country,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_actor)
  returning id,to_jsonb(office_crm_leads.*) into v_id,v_state;
  insert into public.office_crm_audit(actor_user_id,entity_type,entity_id,action,new_state) values(p_actor,'LEAD',v_id,'CREATED',v_state);
  return v_id;
end; $$;

create or replace function public.office_crm_set_lead_stage(p_actor uuid,p_lead uuid,p_stage text,p_customer varchar default null)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_crm_leads%rowtype; v_new jsonb;
begin
  select * into v from public.office_crm_leads where id=p_lead for update;
  if v.id is null then raise exception 'Lead not found'; end if;
  if p_stage not in ('NEW','QUALIFIED','DISQUALIFIED','CONVERTED') then raise exception 'Invalid lead stage'; end if;
  if p_stage='CONVERTED' and nullif(trim(coalesce(p_customer,'')),'') is null then raise exception 'Converted lead requires canonical customer id'; end if;
  update public.office_crm_leads set stage=p_stage,converted_customer_id=case when p_stage='CONVERTED' then p_customer else converted_customer_id end where id=p_lead returning to_jsonb(office_crm_leads.*) into v_new;
  insert into public.office_crm_audit(actor_user_id,entity_type,entity_id,action,previous_state,new_state) values(p_actor,'LEAD',p_lead,'STAGE_CHANGED',to_jsonb(v),v_new);
  return p_stage;
end; $$;

create or replace function public.office_crm_create_opportunity(p_actor uuid,p_owner uuid,p_lead uuid,p_customer varchar,p_product varchar,p_title text,p_value bigint,p_currency text,p_close date,p_next_step text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_state jsonb;
begin
  if not exists(select 1 from public.office_identity_users where user_id=p_actor and status='ACTIVE') then raise exception 'Actor is not active'; end if;
  if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Owner is not active'; end if;
  if p_lead is not null and not exists(select 1 from public.office_crm_leads where id=p_lead) then raise exception 'Lead not found'; end if;
  if p_customer is not null and not exists(select 1 from public.customers where id=p_customer) then raise exception 'Customer not found'; end if;
  if p_product is not null and not exists(select 1 from public.products where id=p_product) then raise exception 'Product not found'; end if;
  insert into public.office_crm_opportunities(lead_id,customer_id,product_id,title,owner_user_id,value_minor,currency,expected_close_date,next_step,created_by)
  values(p_lead,p_customer,p_product,trim(p_title),p_owner,p_value,upper(p_currency),p_close,nullif(trim(coalesce(p_next_step,'')),''),p_actor)
  returning id,to_jsonb(office_crm_opportunities.*) into v_id,v_state;
  insert into public.office_crm_audit(actor_user_id,entity_type,entity_id,action,new_state) values(p_actor,'OPPORTUNITY',v_id,'CREATED',v_state);
  return v_id;
end; $$;

create or replace function public.office_crm_set_opportunity_stage(p_actor uuid,p_opportunity uuid,p_stage text,p_next_step text default null,p_lost_reason text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v public.office_crm_opportunities%rowtype; v_new jsonb;
begin
  select * into v from public.office_crm_opportunities where id=p_opportunity for update;
  if v.id is null then raise exception 'Opportunity not found'; end if;
  if p_stage not in ('QUALIFICATION','DISCOVERY','DEMO','PROPOSAL','NEGOTIATION','CONTRACTING','WON','LOST') then raise exception 'Invalid opportunity stage'; end if;
  if p_stage='LOST' and char_length(trim(coalesce(p_lost_reason,'')))<3 then raise exception 'Lost opportunity requires reason'; end if;
  update public.office_crm_opportunities set stage=p_stage,next_step=coalesce(nullif(trim(coalesce(p_next_step,'')),''),next_step),lost_reason=case when p_stage='LOST' then trim(p_lost_reason) else null end,won_at=case when p_stage='WON' then coalesce(won_at,now()) else null end,lost_at=case when p_stage='LOST' then coalesce(lost_at,now()) else null end where id=p_opportunity returning to_jsonb(office_crm_opportunities.*) into v_new;
  insert into public.office_crm_audit(actor_user_id,entity_type,entity_id,action,previous_state,new_state) values(p_actor,'OPPORTUNITY',p_opportunity,'STAGE_CHANGED',to_jsonb(v),v_new);
  return p_stage;
end; $$;

create or replace function public.office_crm_add_activity(p_actor uuid,p_lead uuid,p_opportunity uuid,p_type text,p_subject text,p_body text,p_occurred_at timestamptz default now())
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  if p_type not in ('NOTE','CALL','EMAIL','MEETING','DEMO','PROPOSAL','FOLLOW_UP','SYSTEM') then raise exception 'Invalid activity type'; end if;
  insert into public.office_crm_activities(lead_id,opportunity_id,activity_type,subject,body,occurred_at,actor_user_id)
  values(p_lead,p_opportunity,p_type,trim(p_subject),nullif(trim(coalesce(p_body,'')),''),coalesce(p_occurred_at,now()),p_actor) returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.office_crm_create_lead(uuid,uuid,text,text,text,text,text,bigint,text,text,text) from anon,authenticated,public;
revoke all on function public.office_crm_set_lead_stage(uuid,uuid,text,varchar) from anon,authenticated,public;
revoke all on function public.office_crm_create_opportunity(uuid,uuid,uuid,varchar,varchar,text,bigint,text,date,text) from anon,authenticated,public;
revoke all on function public.office_crm_set_opportunity_stage(uuid,uuid,text,text,text) from anon,authenticated,public;
revoke all on function public.office_crm_add_activity(uuid,uuid,uuid,text,text,text,timestamptz) from anon,authenticated,public;
grant execute on function public.office_crm_create_lead(uuid,uuid,text,text,text,text,text,bigint,text,text,text) to service_role;
grant execute on function public.office_crm_set_lead_stage(uuid,uuid,text,varchar) to service_role;
grant execute on function public.office_crm_create_opportunity(uuid,uuid,uuid,varchar,varchar,text,bigint,text,date,text) to service_role;
grant execute on function public.office_crm_set_opportunity_stage(uuid,uuid,text,text,text) to service_role;
grant execute on function public.office_crm_add_activity(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

comment on table public.office_crm_opportunities is 'KRAVIA sales pipeline; WON state does not create billing/subscriptions automatically without downstream governed workflows.';
