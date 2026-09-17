-- KRAVIA Document Studio control plane.
-- Documents are composed from versioned structured templates and immutable input
-- snapshots. Rendered PDF/DOCX/HTML files are outputs, never the canonical source.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('document.template.read','DOCUMENTS','READ_TEMPLATE','Read document templates','Read approved template/version metadata inside assigned scope.','STANDARD',false,false,true),
 ('document.template.manage','DOCUMENTS','MANAGE_TEMPLATE','Manage document templates','Create structured template and clause versions without silently replacing published versions.','HIGH',true,true,true),
 ('document.template.publish','DOCUMENTS','PUBLISH_TEMPLATE','Publish document templates','Independently publish a reviewed template or clause version.','CRITICAL',true,true,true),
 ('document.instance.read','DOCUMENTS','READ_INSTANCE','Read document instances','Read document instances and output metadata inside assigned scope.','SENSITIVE',false,true,true),
 ('document.instance.review','DOCUMENTS','REVIEW_INSTANCE','Review document instance','Review a generated business-document instance before final rendering/signing.','HIGH',true,true,true),
 ('document.render','DOCUMENTS','RENDER','Render approved document','Render an approved canonical document to an allowed output format.','HIGH',true,true,true),
 ('document.hr.create','DOCUMENTS','CREATE_HR','Create HR documents','Create authorised HR/employment documents from published templates.','SENSITIVE',true,true,true),
 ('document.secretarial.create','DOCUMENTS','CREATE_SECRETARIAL','Create secretarial documents','Create authorised board/company-secretarial documents from published templates.','CRITICAL',true,true,true),
 ('document.legal.create','DOCUMENTS','CREATE_LEGAL','Create legal documents','Create authorised legal documents from published templates.','CRITICAL',true,true,true),
 ('document.finance.create','DOCUMENTS','CREATE_FINANCE','Create finance documents','Create authorised financial documents from published templates.','HIGH',true,true,true),
 ('document.sales.create','DOCUMENTS','CREATE_SALES','Create sales documents','Create authorised proposals/quotations from published templates.','HIGH',false,true,true),
 ('document.operations.create','DOCUMENTS','CREATE_OPERATIONS','Create operations documents','Create authorised procurement/operations documents from published templates.','HIGH',false,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','document.template.read','ALLOW','COMPANY'),
 ('HR_MANAGER','document.template.manage','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','document.instance.read','ALLOW','COMPANY'),
 ('HR_MANAGER','document.instance.review','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','document.render','ALLOW','DEPARTMENT'),
 ('HR_MANAGER','document.hr.create','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.template.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.template.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.template.publish','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.instance.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.instance.review','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.render','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','document.secretarial.create','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.template.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.template.manage','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.template.publish','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.instance.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.instance.review','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.render','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','document.legal.create','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','document.template.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','document.instance.read','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','document.instance.review','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','document.render','ALLOW','COMPANY'),
 ('FINANCE_MANAGER','document.finance.create','ALLOW','COMPANY'),
 ('ACCOUNTANT','document.template.read','ALLOW','COMPANY'),
 ('ACCOUNTANT','document.instance.read','ALLOW','COMPANY'),
 ('ACCOUNTANT','document.finance.create','ALLOW','COMPANY'),
 ('SALES_MANAGER','document.template.read','ALLOW','DEPARTMENT'),
 ('SALES_MANAGER','document.instance.read','ALLOW','DEPARTMENT'),
 ('SALES_MANAGER','document.instance.review','ALLOW','DEPARTMENT'),
 ('SALES_MANAGER','document.render','ALLOW','DEPARTMENT'),
 ('SALES_MANAGER','document.sales.create','ALLOW','DEPARTMENT'),
 ('SALES_USER','document.template.read','ALLOW','DEPARTMENT'),
 ('SALES_USER','document.instance.read','ALLOW','OWN'),
 ('SALES_USER','document.sales.create','ALLOW','OWN'),
 ('OPERATIONS_MANAGER','document.template.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','document.instance.read','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','document.render','ALLOW','DEPARTMENT'),
 ('OPERATIONS_MANAGER','document.operations.create','ALLOW','DEPARTMENT'),
 ('AUDITOR_READONLY','document.instance.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_request_type_catalog(code,label,module,description,requester_permission,fulfillment_permission,default_priority,default_due_hours,high_risk,active) values
 ('DOCUMENT_INSTANCE_APPROVAL','Document Approval','DOCUMENTS','Review the canonical snapshot and content of a controlled document before final output/signing.','document.instance.read',null,'NORMAL',48,true,true)
on conflict(code) do update set label=excluded.label,module=excluded.module,description=excluded.description,requester_permission=excluded.requester_permission,fulfillment_permission=excluded.fulfillment_permission,default_priority=excluded.default_priority,default_due_hours=excluded.default_due_hours,high_risk=excluded.high_risk,active=true;

insert into public.office_workflow_templates(code,request_type_code,version,label,description,active) values
 ('DOCUMENT_INSTANCE_APPROVAL_V1','DOCUMENT_INSTANCE_APPROVAL',1,'Controlled document approval','Independent document review followed by owner approval for controlled official output.',true)
on conflict(code,version) do update set request_type_code=excluded.request_type_code,label=excluded.label,description=excluded.description,active=true;

insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,1,'DOCUMENT_REVIEW','Document review','PERMISSION','document.instance.review','document.instance.review',1,false,'{}'::jsonb from public.office_workflow_templates where code='DOCUMENT_INSTANCE_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;
insert into public.office_workflow_template_steps(template_id,step_order,step_code,label,approver_selector,approver_value,required_permission,min_approvals,allow_self_approval,condition_json)
select id,2,'OWNER_APPROVAL','Owner approval','OWNER',null,null,1,false,'{}'::jsonb from public.office_workflow_templates where code='DOCUMENT_INSTANCE_APPROVAL_V1' and version=1
on conflict(template_id,step_order) do update set step_code=excluded.step_code,label=excluded.label,approver_selector=excluded.approver_selector,approver_value=excluded.approver_value,required_permission=excluded.required_permission,min_approvals=excluded.min_approvals,allow_self_approval=false,condition_json=excluded.condition_json;

create sequence if not exists public.office_document_instance_seq;
create sequence if not exists public.office_document_delivery_seq;
grant usage on sequence public.office_document_instance_seq,public.office_document_delivery_seq to service_role;

create table if not exists public.office_document_templates(
 id uuid primary key default gen_random_uuid(),
 template_code text not null unique,
 title text not null check(char_length(trim(title)) between 3 and 220),
 category text not null check(category in ('HR','SECRETARIAL','LEGAL','FINANCE','SALES','OPERATIONS','ENGINEERING','COMPLIANCE','GENERAL')),
 owner_department text,
 classification text not null default 'INTERNAL' check(classification in ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED','BOARD','FINANCE','HR','LEGAL','SECURITY','CUSTOMER_CONFIDENTIAL','LEGAL_PRIVILEGED')),
 required_creator_permission text not null references public.office_permission_catalog(code) on delete restrict,
 requires_instance_approval boolean not null default true,
 allowed_outputs text[] not null default array['PDF']::text[],
 status text not null default 'ACTIVE' check(status in ('ACTIVE','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(cardinality(allowed_outputs)>0),
 check(allowed_outputs <@ array['PDF','DOCX','HTML','XLSX']::text[])
);

create table if not exists public.office_document_template_versions(
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.office_document_templates(id) on delete restrict,
 version integer not null check(version>0),
 design_schema jsonb not null default '{}'::jsonb,
 content_schema jsonb not null default '[]'::jsonb,
 variables_schema jsonb not null default '{}'::jsonb,
 clause_rules jsonb not null default '[]'::jsonb,
 clause_snapshot jsonb not null default '{}'::jsonb,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 source_hash text not null check(char_length(source_hash)=64),
 effective_from date,
 effective_to date,
 status text not null default 'DRAFT' check(status in ('DRAFT','REVIEW','PUBLISHED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(template_id,version),
 check(effective_to is null or effective_from is null or effective_to>=effective_from),
 check(jsonb_typeof(design_schema)='object'),
 check(jsonb_typeof(content_schema)='array'),
 check(jsonb_typeof(variables_schema)='object'),
 check(jsonb_typeof(clause_rules)='array'),
 check(jsonb_typeof(clause_snapshot)='object')
);
create index if not exists office_document_versions_template_idx on public.office_document_template_versions(template_id,status,version desc);

create table if not exists public.office_document_clauses(
 id uuid primary key default gen_random_uuid(),
 clause_code text not null unique,
 title text not null,
 category text not null check(category in ('HR','SECRETARIAL','LEGAL','FINANCE','SALES','OPERATIONS','GENERAL')),
 owner_department text,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.office_document_clause_versions(
 id uuid primary key default gen_random_uuid(),
 clause_id uuid not null references public.office_document_clauses(id) on delete restrict,
 version integer not null check(version>0),
 content text not null check(char_length(trim(content))>=3),
 variables_schema jsonb not null default '{}'::jsonb,
 source_reference text not null check(char_length(trim(source_reference))>=3),
 content_hash text not null check(char_length(content_hash)=64),
 effective_from date,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(clause_id,version),
 check(jsonb_typeof(variables_schema)='object')
);

create table if not exists public.office_document_instances(
 id uuid primary key default gen_random_uuid(),
 document_code text not null unique default ('KR-DOC-'||lpad(nextval('public.office_document_instance_seq')::text,8,'0')),
 template_id uuid not null references public.office_document_templates(id) on delete restrict,
 template_version_id uuid not null references public.office_document_template_versions(id) on delete restrict,
 subject_type text not null,
 subject_reference text not null,
 business_record_type text,
 business_record_key text,
 title text not null,
 classification text not null,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 input_snapshot jsonb not null,
 input_hash text not null check(char_length(input_hash)=64),
 composed_content jsonb,
 approval_request_id uuid references public.office_requests(id) on delete restrict,
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','RENDERED','SIGNING','SIGNED','DELIVERED','ARCHIVED','CANCELLED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 approved_by uuid references public.office_identity_users(user_id) on delete restrict,
 approved_at timestamptz,
 signed_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(input_snapshot)='object'),
 check(composed_content is null or jsonb_typeof(composed_content)='object')
);
create index if not exists office_document_instances_owner_idx on public.office_document_instances(owner_user_id,status,created_at desc);

create table if not exists public.office_document_renders(
 id uuid primary key,
 document_instance_id uuid not null references public.office_document_instances(id) on delete restrict,
 output_format text not null check(output_format in ('PDF','DOCX','HTML','XLSX')),
 mime_type text not null,
 storage_reference text not null,
 sha256 text not null check(char_length(sha256)=64),
 byte_size bigint not null check(byte_size>=0),
 status text not null default 'GENERATED' check(status in ('GENERATED','SUPERSEDED','SIGNED','ARCHIVED')),
 generated_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 generated_at timestamptz not null default now(),
 unique(document_instance_id,output_format,sha256)
);

create table if not exists public.office_document_delivery_events(
 id uuid primary key default gen_random_uuid(),
 delivery_code text not null unique default ('KR-DLV-'||lpad(nextval('public.office_document_delivery_seq')::text,8,'0')),
 document_instance_id uuid not null references public.office_document_instances(id) on delete restrict,
 render_id uuid references public.office_document_renders(id) on delete restrict,
 channel text not null check(channel in ('EMAIL','SMS','SECURE_LINK','IN_APP','ESIGN','OTHER')),
 destination_masked text,
 provider_reference text,
 event_type text not null,
 metadata jsonb not null default '{}'::jsonb,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now()
);

create table if not exists public.office_document_engine_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 template_id uuid references public.office_document_templates(id) on delete restrict,
 template_version_id uuid references public.office_document_template_versions(id) on delete restrict,
 document_instance_id uuid references public.office_document_instances(id) on delete restrict,
 event_type text not null,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('office-documents','office-documents',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/html','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.office_document_templates enable row level security;
alter table public.office_document_template_versions enable row level security;
alter table public.office_document_clauses enable row level security;
alter table public.office_document_clause_versions enable row level security;
alter table public.office_document_instances enable row level security;
alter table public.office_document_renders enable row level security;
alter table public.office_document_delivery_events enable row level security;
alter table public.office_document_engine_events enable row level security;
revoke all on public.office_document_templates,public.office_document_template_versions,public.office_document_clauses,public.office_document_clause_versions,public.office_document_instances,public.office_document_renders,public.office_document_delivery_events,public.office_document_engine_events from anon,authenticated;
grant select,insert,update on public.office_document_templates,public.office_document_template_versions,public.office_document_clauses,public.office_document_clause_versions,public.office_document_instances to service_role;
grant select,insert,update on public.office_document_renders to service_role;
grant select,insert on public.office_document_delivery_events,public.office_document_engine_events to service_role;

create or replace function public.office_document_template_create(p_actor uuid,p_code text,p_title text,p_category text,p_department text,p_classification text,p_creator_permission text,p_requires_approval boolean,p_outputs text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text:=nullif(trim(coalesce(p_department,'')),'');
begin
 if not public.office_effective_permission(p_actor,'document.template.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.manage','DEPARTMENT',dept,null) then raise exception 'Document template management permission is required'; end if;
 if not exists(select 1 from public.office_permission_catalog where code=p_creator_permission and active=true) then raise exception 'Required creator permission is unavailable'; end if;
 insert into public.office_document_templates(template_code,title,category,owner_department,classification,required_creator_permission,requires_instance_approval,allowed_outputs,created_by)
 values(upper(trim(p_code)),trim(p_title),upper(trim(p_category)),dept,upper(trim(p_classification)),p_creator_permission,coalesce(p_requires_approval,true),coalesce(p_outputs,array['PDF']::text[]),p_actor) returning id into v_id;
 insert into public.office_document_engine_events(actor_user_id,template_id,event_type,note) values(p_actor,v_id,'TEMPLATE_CREATED',trim(p_title));
 return v_id;
end; $$;

create or replace function public.office_document_template_version_create(p_actor uuid,p_template uuid,p_design jsonb,p_content jsonb,p_variables jsonb,p_clause_rules jsonb,p_source text,p_effective_from date,p_effective_to date)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.office_document_templates%rowtype; v_id uuid; v_version integer; source_hash text; source jsonb;
begin
 select * into t from public.office_document_templates where id=p_template and status='ACTIVE';
 if t.id is null then raise exception 'Document template not found'; end if;
 if not public.office_effective_permission(p_actor,'document.template.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.manage','DEPARTMENT',t.owner_department,null) then raise exception 'Document template management permission is required'; end if;
 select coalesce(max(version),0)+1 into v_version from public.office_document_template_versions where template_id=t.id;
 source:=jsonb_build_object('design',coalesce(p_design,'{}'::jsonb),'content',coalesce(p_content,'[]'::jsonb),'variables',coalesce(p_variables,'{}'::jsonb),'clause_rules',coalesce(p_clause_rules,'[]'::jsonb),'source_reference',trim(p_source));
 source_hash:=encode(extensions.digest(convert_to(source::text,'UTF8'),'sha256'),'hex');
 insert into public.office_document_template_versions(template_id,version,design_schema,content_schema,variables_schema,clause_rules,source_reference,source_hash,effective_from,effective_to,created_by)
 values(t.id,v_version,coalesce(p_design,'{}'::jsonb),coalesce(p_content,'[]'::jsonb),coalesce(p_variables,'{}'::jsonb),coalesce(p_clause_rules,'[]'::jsonb),trim(p_source),source_hash,p_effective_from,p_effective_to,p_actor) returning id into v_id;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,event_type,metadata) values(p_actor,t.id,v_id,'TEMPLATE_VERSION_CREATED',jsonb_build_object('version',v_version,'source_hash',source_hash));
 return v_id;
end; $$;

create or replace function public.office_document_clause_create(p_actor uuid,p_code text,p_title text,p_category text,p_department text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; dept text:=nullif(trim(coalesce(p_department,'')),'');
begin
 if not public.office_effective_permission(p_actor,'document.template.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.manage','DEPARTMENT',dept,null) then raise exception 'Document template management permission is required'; end if;
 insert into public.office_document_clauses(clause_code,title,category,owner_department,created_by) values(upper(trim(p_code)),trim(p_title),upper(trim(p_category)),dept,p_actor) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.office_document_clause_version_create(p_actor uuid,p_clause uuid,p_content text,p_variables jsonb,p_source text,p_effective_from date)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_document_clauses%rowtype; v_id uuid; v_version integer; h text;
begin
 select * into c from public.office_document_clauses where id=p_clause and status='ACTIVE';
 if c.id is null then raise exception 'Document clause not found'; end if;
 if not public.office_effective_permission(p_actor,'document.template.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.manage','DEPARTMENT',c.owner_department,null) then raise exception 'Document template management permission is required'; end if;
 select coalesce(max(version),0)+1 into v_version from public.office_document_clause_versions where clause_id=c.id;
 h:=encode(extensions.digest(convert_to(trim(p_content),'UTF8'),'sha256'),'hex');
 insert into public.office_document_clause_versions(clause_id,version,content,variables_schema,source_reference,content_hash,effective_from,created_by) values(c.id,v_version,trim(p_content),coalesce(p_variables,'{}'::jsonb),trim(p_source),h,p_effective_from,p_actor) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.office_document_clause_publish(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_document_clause_versions%rowtype; c public.office_document_clauses%rowtype;
begin
 select * into v from public.office_document_clause_versions where id=p_version for update;
 if v.id is null or v.status<>'DRAFT' then raise exception 'Clause version is not publishable'; end if;
 select * into c from public.office_document_clauses where id=v.clause_id;
 if v.created_by=p_actor then raise exception 'Clause creator cannot publish the same version'; end if;
 if not public.office_effective_permission(p_actor,'document.template.publish','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.publish','DEPARTMENT',c.owner_department,null) then raise exception 'Document template publish permission is required'; end if;
 update public.office_document_clause_versions set status='RETIRED',updated_at=now() where clause_id=c.id and id<>v.id and status='PUBLISHED';
 update public.office_document_clause_versions set status='PUBLISHED',published_by=p_actor,published_at=now(),updated_at=now() where id=v.id;
 return true;
end; $$;

create or replace function public.office_document_template_version_publish(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_document_template_versions%rowtype; t public.office_document_templates%rowtype; rule jsonb; code text; cv record; snap jsonb:='{}'::jsonb;
begin
 select * into v from public.office_document_template_versions where id=p_version for update;
 if v.id is null or v.status not in ('DRAFT','REVIEW') then raise exception 'Template version is not publishable'; end if;
 select * into t from public.office_document_templates where id=v.template_id;
 if v.created_by=p_actor then raise exception 'Template creator cannot publish the same version'; end if;
 if not public.office_effective_permission(p_actor,'document.template.publish','COMPANY',null,null) and not public.office_effective_permission(p_actor,'document.template.publish','DEPARTMENT',t.owner_department,null) then raise exception 'Document template publish permission is required'; end if;
 for rule in select value from jsonb_array_elements(v.clause_rules) loop
   code:=rule->>'clause_code';
   if code is null then raise exception 'Clause rule is missing clause_code'; end if;
   select c.clause_code,x.version,x.content,x.variables_schema,x.content_hash,x.source_reference into cv from public.office_document_clauses c join public.office_document_clause_versions x on x.clause_id=c.id where c.clause_code=code and c.status='ACTIVE' and x.status='PUBLISHED' and (x.effective_from is null or x.effective_from<=coalesce(v.effective_from,current_date)) order by x.version desc limit 1;
   if cv.clause_code is null then raise exception 'Published clause version missing for %',code; end if;
   snap:=snap||jsonb_build_object(code,jsonb_build_object('version',cv.version,'content',cv.content,'variables_schema',cv.variables_schema,'content_hash',cv.content_hash,'source_reference',cv.source_reference));
 end loop;
 update public.office_document_template_versions set status='RETIRED',updated_at=now() where template_id=t.id and id<>v.id and status='PUBLISHED';
 update public.office_document_template_versions set status='PUBLISHED',clause_snapshot=snap,published_by=p_actor,published_at=now(),updated_at=now() where id=v.id;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,event_type,metadata) values(p_actor,t.id,v.id,'TEMPLATE_PUBLISHED',jsonb_build_object('version',v.version,'source_hash',v.source_hash,'clause_count',jsonb_object_length(snap)));
 return true;
end; $$;

create or replace function public.office_document_instance_create(p_actor uuid,p_template_code text,p_owner uuid,p_subject_type text,p_subject_ref text,p_business_type text,p_business_key text,p_title text,p_input jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.office_document_templates%rowtype; v public.office_document_template_versions%rowtype; v_id uuid; h text;
begin
 select * into t from public.office_document_templates where template_code=upper(trim(p_template_code)) and status='ACTIVE';
 if t.id is null then raise exception 'Published document template is unavailable'; end if;
 if not public.office_effective_permission(p_actor,t.required_creator_permission,'COMPANY',null,p_actor) and not public.office_effective_permission(p_actor,t.required_creator_permission,'DEPARTMENT',t.owner_department,p_actor) and not public.office_effective_permission(p_actor,t.required_creator_permission,'OWN',null,p_actor) then raise exception 'Template creator permission is required'; end if;
 select * into v from public.office_document_template_versions where template_id=t.id and status='PUBLISHED' and (effective_from is null or effective_from<=current_date) and (effective_to is null or effective_to>=current_date) order by version desc limit 1;
 if v.id is null then raise exception 'Published document template version is unavailable'; end if;
 if jsonb_typeof(coalesce(p_input,'{}'::jsonb))<>'object' then raise exception 'Document input snapshot must be an object'; end if;
 h:=encode(extensions.digest(convert_to(coalesce(p_input,'{}'::jsonb)::text,'UTF8'),'sha256'),'hex');
 insert into public.office_document_instances(template_id,template_version_id,subject_type,subject_reference,business_record_type,business_record_key,title,classification,owner_user_id,input_snapshot,input_hash,created_by)
 values(t.id,v.id,upper(trim(p_subject_type)),trim(p_subject_ref),nullif(trim(coalesce(p_business_type,'')),''),nullif(trim(coalesce(p_business_key,'')),''),trim(p_title),t.classification,p_owner,coalesce(p_input,'{}'::jsonb),h,p_actor) returning id into v_id;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata) values(p_actor,t.id,v.id,v_id,'DOCUMENT_INSTANCE_CREATED',jsonb_build_object('input_hash',h,'template_version',v.version));
 return v_id;
end; $$;

create or replace function public.office_document_instance_submit(p_actor uuid,p_instance uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.office_document_instances%rowtype; t public.office_document_templates%rowtype; approval uuid;
begin
 select * into d from public.office_document_instances where id=p_instance for update;
 if d.id is null or d.status not in ('DRAFT','REJECTED') then raise exception 'Document instance is not submittable'; end if;
 if d.created_by<>p_actor and d.owner_user_id<>p_actor and not public.office_effective_permission(p_actor,'document.instance.review','COMPANY',null,null) then raise exception 'Document ownership or review permission is required'; end if;
 select * into t from public.office_document_templates where id=d.template_id;
 if not t.requires_instance_approval then update public.office_document_instances set status='APPROVED',approved_by=p_actor,approved_at=now(),updated_at=now() where id=d.id; return null; end if;
 approval:=public.office_create_request(p_actor,'DOCUMENT_INSTANCE_APPROVAL','Document approval · '||d.document_code,d.title,jsonb_build_object('document_instance_id',d.id,'document_code',d.document_code,'template_id',d.template_id,'template_version_id',d.template_version_id,'input_hash',d.input_hash),'NORMAL',d.owner_user_id,'DOCUMENT_INSTANCE',d.id::text);
 update public.office_document_instances set status='PENDING_APPROVAL',approval_request_id=approval,updated_at=now() where id=d.id;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata) values(p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_SUBMITTED',jsonb_build_object('approval_request_id',approval));
 return approval;
end; $$;

create or replace function public.office_document_instance_sync_approval(p_actor uuid,p_instance uuid)
returns text language plpgsql security definer set search_path='' as $$
declare d public.office_document_instances%rowtype; r public.office_requests%rowtype; final_approver uuid; state text;
begin
 select * into d from public.office_document_instances where id=p_instance for update;
 if d.id is null or d.approval_request_id is null then raise exception 'Document approval request is missing'; end if;
 if d.created_by<>p_actor and d.owner_user_id<>p_actor and not public.office_effective_permission(p_actor,'document.instance.read','COMPANY',null,null) then raise exception 'Document read permission is required'; end if;
 select * into r from public.office_requests where id=d.approval_request_id;
 if r.id is null then raise exception 'Document approval workflow not found'; end if;
 if r.status='APPROVED' then select decision_by into final_approver from public.office_request_steps where request_id=r.id and status='APPROVED' order by step_order desc limit 1; update public.office_document_instances set status='APPROVED',approved_by=final_approver,approved_at=now(),updated_at=now() where id=d.id; state:='APPROVED';
 elsif r.status='REJECTED' then update public.office_document_instances set status='REJECTED',updated_at=now() where id=d.id; state:='REJECTED'; else state:='PENDING_APPROVAL'; end if;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata) values(p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_APPROVAL_SYNCED',jsonb_build_object('workflow_status',r.status,'document_status',state));
 return state;
end; $$;

create or replace function public.office_document_record_render(p_actor uuid,p_instance uuid,p_render uuid,p_format text,p_mime text,p_storage text,p_sha text,p_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.office_document_instances%rowtype; t public.office_document_templates%rowtype; f text:=upper(trim(p_format));
begin
 select * into d from public.office_document_instances where id=p_instance for update;
 if d.id is null or d.status not in ('APPROVED','RENDERED','SIGNING','SIGNED') then raise exception 'Approved document instance is required for rendering'; end if;
 select * into t from public.office_document_templates where id=d.template_id;
 if not f=any(t.allowed_outputs) then raise exception 'Requested output format is not allowed by template'; end if;
 if not public.office_effective_permission(p_actor,'document.render','COMPANY',null,null) and d.created_by<>p_actor and d.owner_user_id<>p_actor then raise exception 'Document render permission is required'; end if;
 insert into public.office_document_renders(id,document_instance_id,output_format,mime_type,storage_reference,sha256,byte_size,generated_by) values(p_render,d.id,f,p_mime,p_storage,lower(trim(p_sha)),p_size,p_actor);
 if d.status='APPROVED' then update public.office_document_instances set status='RENDERED',updated_at=now() where id=d.id; end if;
 insert into public.office_document_engine_events(actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata) values(p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_RENDERED',jsonb_build_object('render_id',p_render,'format',f,'sha256',lower(trim(p_sha)),'byte_size',p_size,'storage_reference',p_storage));
 return p_render;
end; $$;

revoke all on function public.office_document_template_create(uuid,text,text,text,text,text,text,boolean,text[]) from public,anon,authenticated;
revoke all on function public.office_document_template_version_create(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,date,date) from public,anon,authenticated;
revoke all on function public.office_document_clause_create(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_document_clause_version_create(uuid,uuid,text,jsonb,text,date) from public,anon,authenticated;
revoke all on function public.office_document_clause_publish(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_document_template_version_publish(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_document_instance_create(uuid,text,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.office_document_instance_submit(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_document_instance_sync_approval(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_document_record_render(uuid,uuid,uuid,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.office_document_template_create(uuid,text,text,text,text,text,text,boolean,text[]) to service_role;
grant execute on function public.office_document_template_version_create(uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,date,date) to service_role;
grant execute on function public.office_document_clause_create(uuid,text,text,text,text) to service_role;
grant execute on function public.office_document_clause_version_create(uuid,uuid,text,jsonb,text,date) to service_role;
grant execute on function public.office_document_clause_publish(uuid,uuid) to service_role;
grant execute on function public.office_document_template_version_publish(uuid,uuid) to service_role;
grant execute on function public.office_document_instance_create(uuid,text,uuid,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.office_document_instance_submit(uuid,uuid) to service_role;
grant execute on function public.office_document_instance_sync_approval(uuid,uuid) to service_role;
grant execute on function public.office_document_record_render(uuid,uuid,uuid,text,text,text,text,bigint) to service_role;
