-- Evidence-led compliance applicability engine.
-- No law, threshold or deadline is hard-coded as currently applicable merely by
-- creating this engine. Rules require an authoritative source, effective dates,
-- approval and human/professional applicability review before obligations close.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('compliance.rules.read','COMPLIANCE','READ_RULES','Read compliance rules','Read approved/draft applicability rules, facts and assessments.','HIGH',false,false,true),
 ('compliance.rules.manage','COMPLIANCE','MANAGE_RULES','Manage compliance rules','Create source-backed rules and submit/retire them under controlled governance.','CRITICAL',true,true,true),
 ('compliance.facts.manage','COMPLIANCE','MANAGE_FACTS','Manage applicability facts','Record source-backed company facts used by applicability evaluation.','HIGH',true,true,true),
 ('compliance.applicability.review','COMPLIANCE','REVIEW_APPLICABILITY','Review applicability','Human/professional review of system candidate applicability decisions.','CRITICAL',true,true,true),
 ('compliance.instance.manage','COMPLIANCE','MANAGE_INSTANCE','Manage compliance instance','Create and transition evidence-backed obligation instances from reviewed applicable rules.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('CS_SECRETARIAL','compliance.rules.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','compliance.rules.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','compliance.facts.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','compliance.applicability.review','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','compliance.instance.manage','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','compliance.rules.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','compliance.applicability.review','ALLOW','COMPANY'),
 ('CA_TAX','compliance.rules.read','ALLOW','COMPANY'),
 ('CA_TAX','compliance.applicability.review','ALLOW','COMPANY'),
 ('CA_TAX','compliance.instance.manage','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','compliance.rules.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create table if not exists public.office_compliance_packs(
 code text primary key,
 label text not null,
 jurisdiction text not null,
 description text not null,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','RETIRED')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

insert into public.office_compliance_packs(code,label,jurisdiction,description) values
 ('INDIA_CORPORATE','India Corporate','IN','Corporate and company-secretarial applicability rules validated against current authoritative sources.'),
 ('TAX_GST','Tax & GST','IN','Tax and GST rules whose applicability depends on current registrations, activities, thresholds and effective law.'),
 ('STATE_EMPLOYMENT','State Employment','IN','State/location-dependent establishment, employment and payroll rules.'),
 ('HR_LABOUR','HR / Labour','IN','Workforce-threshold and employment-condition rules.'),
 ('PRIVACY_DPDP','Privacy / DPDP','IN','Privacy obligations tracked with commencement/effective-date awareness.'),
 ('CYBER_CERTIN','Cybersecurity / CERT-In','IN','Cybersecurity and incident obligations validated against current directions.'),
 ('MSME_PROCUREMENT','MSME Procurement','IN','Supplier/payment/reporting rules conditional on vendor classification and current law.'),
 ('SOFTWARE_SAAS','Software / SaaS','GLOBAL','Product, consumer, communications and software-service obligations.'),
 ('IP_TRADEMARK','IP / Trademark','GLOBAL','Intellectual-property registrations, licences and renewal obligations.'),
 ('FOREIGN_OPERATIONS','Foreign Operations','GLOBAL','Country-specific privacy, tax, consumer, payment and store requirements activated only after reviewed applicability.')
on conflict(code) do update set label=excluded.label,jurisdiction=excluded.jurisdiction,description=excluded.description,status='ACTIVE',updated_at=now();

create table if not exists public.office_applicability_facts(
 fact_code text primary key,
 label text not null,
 fact_type text not null check(fact_type in ('BOOLEAN','NUMBER','TEXT','DATE','JSON')),
 value_json jsonb not null,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 effective_from date not null default current_date,
 effective_to date,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','SUPERSEDED','RETIRED')),
 recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>=effective_from)
);

create table if not exists public.office_compliance_rules(
 rule_code text primary key,
 pack_code text not null references public.office_compliance_packs(code) on delete restrict,
 jurisdiction text not null,
 title text not null check(char_length(trim(title)) between 3 and 240),
 authority text not null,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 section_reference text,
 effective_from date not null,
 effective_to date,
 condition_json jsonb not null default '{}'::jsonb,
 frequency text not null default 'EVENT' check(frequency in ('EVENT','ONCE','MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','CUSTOM')),
 due_formula_text text not null,
 owner_department text,
 reviewer_profile text,
 approver_role text,
 evidence_requirements jsonb not null default '[]'::jsonb,
 retention_rule_text text,
 escalation_json jsonb not null default '{}'::jsonb,
 status text not null default 'DRAFT' check(status in ('DRAFT','APPROVED','RETIRED')),
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 last_legal_review_at timestamptz,
 review_note text,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(effective_to is null or effective_to>=effective_from),
 check(jsonb_typeof(condition_json)='object'),
 check(jsonb_typeof(evidence_requirements)='array'),
 check(jsonb_typeof(escalation_json)='object')
);
create index if not exists office_compliance_rules_pack_idx on public.office_compliance_rules(pack_code,status,effective_from);

create table if not exists public.office_compliance_assessments(
 id uuid primary key default gen_random_uuid(),
 rule_code text not null references public.office_compliance_rules(rule_code) on delete restrict,
 candidate_result text not null check(candidate_result in ('APPLICABLE','NOT_APPLICABLE','UNKNOWN')),
 candidate_reason text not null,
 missing_facts text[] not null default '{}',
 facts_snapshot jsonb not null default '{}'::jsonb,
 evaluated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 evaluated_at timestamptz not null default now(),
 review_status text not null default 'PENDING_REVIEW' check(review_status in ('PENDING_REVIEW','REVIEWED')),
 reviewed_result text check(reviewed_result in ('APPLICABLE','NOT_APPLICABLE','UNKNOWN')),
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now()
);
create index if not exists office_compliance_assessments_rule_idx on public.office_compliance_assessments(rule_code,evaluated_at desc);

create table if not exists public.office_compliance_instances(
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.office_compliance_assessments(id) on delete restrict,
 rule_code text not null references public.office_compliance_rules(rule_code) on delete restrict,
 period_key text not null,
 title text not null,
 due_at timestamptz,
 due_basis text not null check(char_length(trim(due_basis))>=3),
 source_reference text not null,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewer_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 status text not null default 'OPEN' check(status in ('OPEN','PREPARED','REVIEWED','APPROVED','FILED','EVIDENCE_COMPLETE','NOT_APPLICABLE','CLOSED')),
 filing_reference text,
 evidence_reference text,
 completion_note text,
 completed_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(rule_code,period_key)
);
create index if not exists office_compliance_instances_due_idx on public.office_compliance_instances(status,due_at);

create table if not exists public.office_compliance_engine_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 rule_code text references public.office_compliance_rules(rule_code) on delete restrict,
 assessment_id uuid references public.office_compliance_assessments(id) on delete restrict,
 instance_id uuid references public.office_compliance_instances(id) on delete restrict,
 event_type text not null,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_compliance_packs enable row level security;
alter table public.office_applicability_facts enable row level security;
alter table public.office_compliance_rules enable row level security;
alter table public.office_compliance_assessments enable row level security;
alter table public.office_compliance_instances enable row level security;
alter table public.office_compliance_engine_events enable row level security;
revoke all on public.office_compliance_packs,public.office_applicability_facts,public.office_compliance_rules,public.office_compliance_assessments,public.office_compliance_instances,public.office_compliance_engine_events from anon,authenticated;
grant select on public.office_compliance_packs to service_role;
grant select,insert,update on public.office_applicability_facts,public.office_compliance_rules,public.office_compliance_assessments,public.office_compliance_instances to service_role;
grant select,insert on public.office_compliance_engine_events to service_role;

create or replace function public.office_compliance_compare(p_actual jsonb,p_op text,p_expected jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare op text:=lower(trim(coalesce(p_op,'')));
begin
 if op='eq' then return p_actual=p_expected; end if;
 if op='neq' then return p_actual<>p_expected; end if;
 if op='in' then return jsonb_typeof(p_expected)='array' and p_expected @> jsonb_build_array(p_actual); end if;
 if op in ('gt','gte','lt','lte') then
   if jsonb_typeof(p_actual)<>'number' or jsonb_typeof(p_expected)<>'number' then return false; end if;
   if op='gt' then return (p_actual#>>'{}')::numeric>(p_expected#>>'{}')::numeric; end if;
   if op='gte' then return (p_actual#>>'{}')::numeric>=(p_expected#>>'{}')::numeric; end if;
   if op='lt' then return (p_actual#>>'{}')::numeric<(p_expected#>>'{}')::numeric; end if;
   return (p_actual#>>'{}')::numeric<=(p_expected#>>'{}')::numeric;
 end if;
 return false;
end; $$;

create or replace function public.office_compliance_condition_match(p_condition jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare item jsonb; fact_value jsonb; op text; fact_code text;
begin
 if p_condition is null or p_condition='{}'::jsonb then return true; end if;
 if p_condition ? 'all' then
   if jsonb_typeof(p_condition->'all')<>'array' then return false; end if;
   for item in select value from jsonb_array_elements(p_condition->'all') loop
     if not public.office_compliance_condition_match(item) then return false; end if;
   end loop;
   return true;
 end if;
 if p_condition ? 'any' then
   if jsonb_typeof(p_condition->'any')<>'array' then return false; end if;
   for item in select value from jsonb_array_elements(p_condition->'any') loop
     if public.office_compliance_condition_match(item) then return true; end if;
   end loop;
   return false;
 end if;
 if p_condition ? 'not' then return not public.office_compliance_condition_match(p_condition->'not'); end if;
 fact_code:=p_condition->>'fact'; op:=lower(coalesce(p_condition->>'op','eq'));
 if fact_code is null then return false; end if;
 select value_json into fact_value from public.office_applicability_facts where fact_code=public.office_compliance_condition_match.fact_code and status='ACTIVE' and effective_from<=current_date and (effective_to is null or effective_to>=current_date);
 if not found then return false; end if;
 if op='exists' then return true; end if;
 return public.office_compliance_compare(fact_value,op,p_condition->'value');
end; $$;

create or replace function public.office_compliance_rule_missing_facts(p_condition jsonb)
returns text[] language sql stable security definer set search_path='' as $$
 with required as (
   select distinct trim(both '"' from value::text) as fact_code
   from jsonb_path_query(coalesce(p_condition,'{}'::jsonb),'$.**.fact') value
 ), missing as (
   select r.fact_code from required r where not exists(
     select 1 from public.office_applicability_facts f where f.fact_code=r.fact_code and f.status='ACTIVE' and f.effective_from<=current_date and (f.effective_to is null or f.effective_to>=current_date)
   )
 ) select coalesce(array_agg(fact_code order by fact_code),'{}'::text[]) from missing
$$;

create or replace function public.office_compliance_upsert_fact(p_actor uuid,p_code text,p_label text,p_type text,p_value jsonb,p_source text,p_effective_from date,p_effective_to date default null)
returns text language plpgsql security definer set search_path='' as $$
begin
 if not public.office_effective_permission(p_actor,'compliance.facts.manage','COMPANY',null,null) then raise exception 'Compliance fact management permission is required'; end if;
 if upper(p_type) not in ('BOOLEAN','NUMBER','TEXT','DATE','JSON') then raise exception 'Invalid fact type'; end if;
 insert into public.office_applicability_facts(fact_code,label,fact_type,value_json,source_reference,effective_from,effective_to,recorded_by)
 values(upper(trim(p_code)),trim(p_label),upper(p_type),p_value,trim(p_source),coalesce(p_effective_from,current_date),p_effective_to,p_actor)
 on conflict(fact_code) do update set label=excluded.label,fact_type=excluded.fact_type,value_json=excluded.value_json,source_reference=excluded.source_reference,effective_from=excluded.effective_from,effective_to=excluded.effective_to,status='ACTIVE',recorded_by=p_actor,reviewed_by=null,reviewed_at=null,updated_at=now();
 insert into public.office_compliance_engine_events(actor_user_id,event_type,note,metadata) values(p_actor,'FACT_RECORDED',upper(trim(p_code)),jsonb_build_object('source_reference',trim(p_source)));
 return upper(trim(p_code));
end; $$;

create or replace function public.office_compliance_create_rule(
 p_actor uuid,p_rule_code text,p_pack text,p_jurisdiction text,p_title text,p_authority text,p_source text,p_section text,p_effective_from date,p_effective_to date,p_condition jsonb,p_frequency text,p_due_formula text,p_owner_department text,p_reviewer_profile text,p_approver_role text,p_evidence jsonb,p_retention text,p_escalation jsonb
)
returns text language plpgsql security definer set search_path='' as $$
declare code text:=upper(trim(p_rule_code));
begin
 if not public.office_effective_permission(p_actor,'compliance.rules.manage','COMPANY',null,null) then raise exception 'Compliance rule management permission is required'; end if;
 if not exists(select 1 from public.office_compliance_packs where code=upper(trim(p_pack)) and status='ACTIVE') then raise exception 'Compliance pack is unavailable'; end if;
 insert into public.office_compliance_rules(rule_code,pack_code,jurisdiction,title,authority,source_reference,section_reference,effective_from,effective_to,condition_json,frequency,due_formula_text,owner_department,reviewer_profile,approver_role,evidence_requirements,retention_rule_text,escalation_json,created_by)
 values(code,upper(trim(p_pack)),upper(trim(p_jurisdiction)),trim(p_title),trim(p_authority),trim(p_source),nullif(trim(coalesce(p_section,'')),''),p_effective_from,p_effective_to,coalesce(p_condition,'{}'::jsonb),upper(trim(p_frequency)),trim(p_due_formula),nullif(trim(coalesce(p_owner_department,'')),''),nullif(trim(coalesce(p_reviewer_profile,'')),''),nullif(trim(coalesce(p_approver_role,'')),''),coalesce(p_evidence,'[]'::jsonb),nullif(trim(coalesce(p_retention,'')),''),coalesce(p_escalation,'{}'::jsonb),p_actor)
 on conflict(rule_code) do update set pack_code=excluded.pack_code,jurisdiction=excluded.jurisdiction,title=excluded.title,authority=excluded.authority,source_reference=excluded.source_reference,section_reference=excluded.section_reference,effective_from=excluded.effective_from,effective_to=excluded.effective_to,condition_json=excluded.condition_json,frequency=excluded.frequency,due_formula_text=excluded.due_formula_text,owner_department=excluded.owner_department,reviewer_profile=excluded.reviewer_profile,approver_role=excluded.approver_role,evidence_requirements=excluded.evidence_requirements,retention_rule_text=excluded.retention_rule_text,escalation_json=excluded.escalation_json,status='DRAFT',approved_by=null,approved_at=null,last_legal_review_at=null,review_note=null,updated_at=now();
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,event_type,note,metadata) values(p_actor,code,'RULE_DRAFT_SAVED',trim(p_title),jsonb_build_object('source_reference',trim(p_source)));
 return code;
end; $$;

create or replace function public.office_compliance_approve_rule(p_actor uuid,p_rule text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_compliance_rules%rowtype;
begin
 if not public.office_effective_permission(p_actor,'compliance.applicability.review','COMPANY',null,null) then raise exception 'Compliance professional review permission is required'; end if;
 select * into r from public.office_compliance_rules where rule_code=upper(trim(p_rule)) for update;
 if r.rule_code is null or r.status<>'DRAFT' then raise exception 'Draft compliance rule not found'; end if;
 if r.created_by=p_actor then raise exception 'Rule author cannot independently approve the same rule'; end if;
 if char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Professional review note is required'; end if;
 update public.office_compliance_rules set status='APPROVED',approved_by=p_actor,approved_at=now(),last_legal_review_at=now(),review_note=trim(p_note),updated_at=now() where rule_code=r.rule_code;
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,event_type,note) values(p_actor,r.rule_code,'RULE_APPROVED',trim(p_note));
 return 'APPROVED';
end; $$;

create or replace function public.office_compliance_evaluate_rule(p_actor uuid,p_rule text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.office_compliance_rules%rowtype; missing text[]; candidate text; reason text; snapshot jsonb; assessment uuid;
begin
 if not public.office_effective_permission(p_actor,'compliance.rules.read','COMPANY',null,null) then raise exception 'Compliance rule read permission is required'; end if;
 select * into r from public.office_compliance_rules where rule_code=upper(trim(p_rule)) and status='APPROVED';
 if r.rule_code is null then raise exception 'Approved compliance rule not found'; end if;
 if current_date<r.effective_from or (r.effective_to is not null and current_date>r.effective_to) then candidate:='NOT_APPLICABLE'; reason:='Outside the approved rule effective-date window'; missing:='{}';
 else
   missing:=public.office_compliance_rule_missing_facts(r.condition_json);
   if cardinality(missing)>0 then candidate:='UNKNOWN'; reason:='Required applicability facts are missing';
   elsif public.office_compliance_condition_match(r.condition_json) then candidate:='APPLICABLE'; reason:='Approved rule condition matched recorded active facts';
   else candidate:='NOT_APPLICABLE'; reason:='Approved rule condition did not match recorded active facts'; end if;
 end if;
 select coalesce(jsonb_object_agg(fact_code,value_json),'{}'::jsonb) into snapshot from public.office_applicability_facts where status='ACTIVE' and effective_from<=current_date and (effective_to is null or effective_to>=current_date);
 insert into public.office_compliance_assessments(rule_code,candidate_result,candidate_reason,missing_facts,facts_snapshot,evaluated_by) values(r.rule_code,candidate,reason,coalesce(missing,'{}'),coalesce(snapshot,'{}'::jsonb),p_actor) returning id into assessment;
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,assessment_id,event_type,note,metadata) values(p_actor,r.rule_code,assessment,'RULE_EVALUATED',reason,jsonb_build_object('candidate',candidate,'missing_facts',coalesce(missing,'{}')));
 return assessment;
end; $$;

create or replace function public.office_compliance_review_assessment(p_actor uuid,p_assessment uuid,p_result text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_compliance_assessments%rowtype; result text:=upper(trim(p_result));
begin
 if not public.office_effective_permission(p_actor,'compliance.applicability.review','COMPANY',null,null) then raise exception 'Compliance professional review permission is required'; end if;
 select * into a from public.office_compliance_assessments where id=p_assessment for update;
 if a.id is null or a.review_status='REVIEWED' then raise exception 'Assessment is unavailable for review'; end if;
 if result not in ('APPLICABLE','NOT_APPLICABLE','UNKNOWN') then raise exception 'Invalid reviewed applicability result'; end if;
 if a.evaluated_by=p_actor then raise exception 'Evaluator cannot independently review the same assessment'; end if;
 if char_length(trim(coalesce(p_note,'')))<3 then raise exception 'Review basis is required'; end if;
 update public.office_compliance_assessments set review_status='REVIEWED',reviewed_result=result,reviewed_by=p_actor,reviewed_at=now(),review_note=trim(p_note) where id=p_assessment;
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,assessment_id,event_type,note,metadata) values(p_actor,a.rule_code,p_assessment,'APPLICABILITY_REVIEWED',trim(p_note),jsonb_build_object('reviewed_result',result));
 return result;
end; $$;

create or replace function public.office_compliance_create_instance(p_actor uuid,p_assessment uuid,p_period_key text,p_title text,p_due_at timestamptz,p_due_basis text,p_owner uuid,p_reviewer uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.office_compliance_assessments%rowtype; r public.office_compliance_rules%rowtype; v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'compliance.instance.manage','COMPANY',null,null) then raise exception 'Compliance instance management permission is required'; end if;
 select * into a from public.office_compliance_assessments where id=p_assessment;
 if a.id is null or a.review_status<>'REVIEWED' or a.reviewed_result<>'APPLICABLE' then raise exception 'A reviewed applicable assessment is required'; end if;
 select * into r from public.office_compliance_rules where rule_code=a.rule_code and status='APPROVED';
 if r.rule_code is null then raise exception 'Approved rule not found'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active obligation owner is required'; end if;
 insert into public.office_compliance_instances(assessment_id,rule_code,period_key,title,due_at,due_basis,source_reference,owner_user_id,reviewer_user_id,created_by)
 values(p_assessment,a.rule_code,trim(p_period_key),trim(p_title),p_due_at,trim(p_due_basis),r.source_reference,p_owner,p_reviewer,p_actor) returning id into v_id;
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,assessment_id,instance_id,event_type,note,metadata) values(p_actor,a.rule_code,p_assessment,v_id,'OBLIGATION_INSTANCE_CREATED',trim(p_title),jsonb_build_object('due_at',p_due_at,'due_basis',trim(p_due_basis)));
 insert into public.office_notifications(user_id,kind,title,body) values(p_owner,'TASK_ASSIGNED','Compliance obligation assigned',left(trim(p_title),180));
 return v_id;
end; $$;

create or replace function public.office_compliance_transition_instance(p_actor uuid,p_instance uuid,p_status text,p_filing text default null,p_evidence text default null,p_note text default null)
returns text language plpgsql security definer set search_path='' as $$
declare i public.office_compliance_instances%rowtype; state text:=upper(trim(p_status));
begin
 select * into i from public.office_compliance_instances where id=p_instance for update;
 if i.id is null then raise exception 'Compliance instance not found'; end if;
 if p_actor<>i.owner_user_id and p_actor<>i.reviewer_user_id and not public.office_effective_permission(p_actor,'compliance.instance.manage','COMPANY',null,null) then raise exception 'Compliance instance authority is required'; end if;
 if i.status in ('CLOSED','NOT_APPLICABLE') then raise exception 'Closed compliance instance cannot be altered'; end if;
 if state not in ('OPEN','PREPARED','REVIEWED','APPROVED','FILED','EVIDENCE_COMPLETE','NOT_APPLICABLE','CLOSED') then raise exception 'Invalid compliance status'; end if;
 if state='FILED' and char_length(trim(coalesce(p_filing,'')))<3 then raise exception 'Filing/reference evidence is required'; end if;
 if state in ('EVIDENCE_COMPLETE','CLOSED') and char_length(trim(coalesce(p_evidence,'')))<3 then raise exception 'Completion evidence reference is required'; end if;
 update public.office_compliance_instances set status=state,filing_reference=case when state='FILED' then trim(p_filing) else filing_reference end,evidence_reference=case when state in ('EVIDENCE_COMPLETE','CLOSED') then trim(p_evidence) else evidence_reference end,completion_note=case when state in ('NOT_APPLICABLE','CLOSED') then nullif(trim(coalesce(p_note,'')),'') else completion_note end,completed_at=case when state in ('NOT_APPLICABLE','CLOSED') then now() else completed_at end,updated_at=now() where id=p_instance;
 insert into public.office_compliance_engine_events(actor_user_id,rule_code,instance_id,event_type,note,metadata) values(p_actor,i.rule_code,p_instance,'OBLIGATION_STATUS_CHANGED',nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('from',i.status,'to',state,'filing_reference',nullif(trim(coalesce(p_filing,'')),''),'evidence_reference',nullif(trim(coalesce(p_evidence,'')),'')));
 return state;
end; $$;

revoke all on function public.office_compliance_compare(jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.office_compliance_condition_match(jsonb) from public,anon,authenticated;
revoke all on function public.office_compliance_rule_missing_facts(jsonb) from public,anon,authenticated;
revoke all on function public.office_compliance_upsert_fact(uuid,text,text,text,jsonb,text,date,date) from public,anon,authenticated;
revoke all on function public.office_compliance_create_rule(uuid,text,text,text,text,text,text,text,date,date,jsonb,text,text,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke all on function public.office_compliance_approve_rule(uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_compliance_evaluate_rule(uuid,text) from public,anon,authenticated;
revoke all on function public.office_compliance_review_assessment(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_compliance_create_instance(uuid,uuid,text,text,timestamptz,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_compliance_transition_instance(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.office_compliance_compare(jsonb,text,jsonb) to service_role;
grant execute on function public.office_compliance_condition_match(jsonb) to service_role;
grant execute on function public.office_compliance_rule_missing_facts(jsonb) to service_role;
grant execute on function public.office_compliance_upsert_fact(uuid,text,text,text,jsonb,text,date,date) to service_role;
grant execute on function public.office_compliance_create_rule(uuid,text,text,text,text,text,text,text,date,date,jsonb,text,text,text,text,text,jsonb,text,jsonb) to service_role;
grant execute on function public.office_compliance_approve_rule(uuid,text,text) to service_role;
grant execute on function public.office_compliance_evaluate_rule(uuid,text) to service_role;
grant execute on function public.office_compliance_review_assessment(uuid,uuid,text,text) to service_role;
grant execute on function public.office_compliance_create_instance(uuid,uuid,text,text,timestamptz,text,uuid,uuid) to service_role;
grant execute on function public.office_compliance_transition_instance(uuid,uuid,text,text,text,text) to service_role;
