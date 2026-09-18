-- KRAVIA Office OS — internal policy, announcements and knowledge.
-- Published policy/knowledge versions are immutable evidence; later changes create a new version.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('policy.read','PEOPLE','READ_POLICY','Read policies','Read published company policies assigned to the actor audience.','STANDARD',false,false,true),
 ('policy.manage','PEOPLE','MANAGE_POLICY','Manage policy drafts','Create policy drafts and future versions without independently publishing own work.','HIGH',true,true,true),
 ('policy.publish','PEOPLE','PUBLISH_POLICY','Publish policy version','Independently publish or retire policy versions.','CRITICAL',true,true,true),
 ('announcement.read','PEOPLE','READ_ANNOUNCEMENT','Read announcements','Read company announcements assigned to actor audience.','STANDARD',false,false,true),
 ('announcement.manage','PEOPLE','MANAGE_ANNOUNCEMENT','Manage announcements','Create and publish controlled internal announcements.','HIGH',true,true,true),
 ('knowledge.read','KNOWLEDGE','READ','Read internal knowledge','Read published SOP, architecture, runbook and handbook material in actor scope.','STANDARD',false,false,true),
 ('knowledge.manage','KNOWLEDGE','MANAGE','Manage knowledge drafts','Create internal knowledge drafts and revisions.','HIGH',true,true,true),
 ('knowledge.publish','KNOWLEDGE','PUBLISH','Publish knowledge','Independently publish or retire knowledge revisions.','HIGH',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'policy.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'announcement.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;
insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
select code,'knowledge.read','ALLOW','COMPANY' from public.office_access_profile_catalog
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','policy.manage','ALLOW','COMPANY'),
 ('HR_MANAGER','policy.publish','ALLOW','COMPANY'),
 ('HR_MANAGER','announcement.manage','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','policy.manage','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','policy.publish','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','policy.manage','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','policy.publish','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','announcement.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','announcement.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','knowledge.manage','ALLOW','COMPANY'),
 ('OPERATIONS_MANAGER','knowledge.publish','ALLOW','COMPANY'),
 ('PRODUCT_MANAGER','knowledge.manage','ALLOW','DEPARTMENT'),
 ('PRODUCT_MANAGER','knowledge.publish','ALLOW','DEPARTMENT')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_policy_seq;
create sequence if not exists public.office_announcement_seq;
create sequence if not exists public.office_knowledge_seq;
grant usage,select on sequence public.office_policy_seq,public.office_announcement_seq,public.office_knowledge_seq to service_role;

create table if not exists public.office_policies(
 id uuid primary key default gen_random_uuid(),
 policy_code text not null unique default ('KR-POL-'||lpad(nextval('public.office_policy_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 category text not null check(category in ('GOVERNANCE','HR','SECURITY','PRIVACY','FINANCE','PROCUREMENT','LEGAL','ENGINEERING','AI','REMOTE_WORK','ATTENDANCE','LEAVE','ETHICS','OTHER')),
 audience_type text not null default 'COMPANY' check(audience_type in ('COMPANY','DEPARTMENT','ROLE')),
 audience_key text,
 acknowledgement_required boolean not null default true,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 current_version integer,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((audience_type='COMPANY' and audience_key is null) or (audience_type<>'COMPANY' and audience_key is not null))
);

create table if not exists public.office_policy_versions(
 id uuid primary key default gen_random_uuid(),
 policy_id uuid not null references public.office_policies(id) on delete restrict,
 version integer not null check(version>0),
 content_text text not null check(char_length(trim(content_text))>=10),
 effective_on date,
 change_summary text,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','SUPERSEDED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 published_at timestamptz,
 content_sha256 text not null check(char_length(content_sha256)=64),
 created_at timestamptz not null default now(),
 unique(policy_id,version)
);

create table if not exists public.office_policy_acknowledgements(
 id uuid primary key default gen_random_uuid(),
 policy_version_id uuid not null references public.office_policy_versions(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 acknowledged_at timestamptz not null default now(),
 source text not null default 'KRAVIA_OFFICE',
 unique(policy_version_id,user_id)
);
create index if not exists office_policy_ack_user_idx on public.office_policy_acknowledgements(user_id,acknowledged_at desc);

create table if not exists public.office_announcements(
 id uuid primary key default gen_random_uuid(),
 announcement_code text not null unique default ('KR-ANN-'||lpad(nextval('public.office_announcement_seq')::text,6,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 body_text text not null check(char_length(trim(body_text))>=3),
 announcement_type text not null default 'GENERAL' check(announcement_type in ('GENERAL','POLICY','SECURITY_ALERT','HOLIDAY','OFFICE','PRODUCT','EMERGENCY','OTHER')),
 audience_type text not null default 'COMPANY' check(audience_type in ('COMPANY','DEPARTMENT','ROLE')),
 audience_key text,
 requires_ack boolean not null default false,
 priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','CRITICAL')),
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','RETIRED')),
 published_at timestamptz,
 expires_at timestamptz,
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((audience_type='COMPANY' and audience_key is null) or (audience_type<>'COMPANY' and audience_key is not null))
);

create table if not exists public.office_announcement_receipts(
 id uuid primary key default gen_random_uuid(),
 announcement_id uuid not null references public.office_announcements(id) on delete restrict,
 user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 read_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 unique(announcement_id,user_id)
);
create index if not exists office_announcement_receipt_user_idx on public.office_announcement_receipts(user_id,read_at desc);

create table if not exists public.office_knowledge_articles(
 id uuid primary key default gen_random_uuid(),
 article_code text not null unique default ('KR-KNW-'||lpad(nextval('public.office_knowledge_seq')::text,7,'0')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 category text not null check(category in ('SOP','RUNBOOK','ARCHITECTURE','HANDBOOK','PRODUCT','SECURITY','FINANCE','HR','LEGAL','SUPPORT','OTHER')),
 audience_type text not null default 'COMPANY' check(audience_type in ('COMPANY','DEPARTMENT','ROLE')),
 audience_key text,
 owner_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 current_version integer,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((audience_type='COMPANY' and audience_key is null) or (audience_type<>'COMPANY' and audience_key is not null))
);

create table if not exists public.office_knowledge_versions(
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null references public.office_knowledge_articles(id) on delete restrict,
 version integer not null check(version>0),
 content_text text not null check(char_length(trim(content_text))>=10),
 change_summary text,
 status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','SUPERSEDED','RETIRED')),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 published_by uuid references public.office_identity_users(user_id) on delete restrict,
 published_at timestamptz,
 content_sha256 text not null check(char_length(content_sha256)=64),
 created_at timestamptz not null default now(),
 unique(article_id,version)
);

create table if not exists public.office_policy_knowledge_events(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 policy_id uuid references public.office_policies(id) on delete restrict,
 policy_version_id uuid references public.office_policy_versions(id) on delete restrict,
 announcement_id uuid references public.office_announcements(id) on delete restrict,
 article_id uuid references public.office_knowledge_articles(id) on delete restrict,
 article_version_id uuid references public.office_knowledge_versions(id) on delete restrict,
 event_type text not null,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_policies enable row level security;
alter table public.office_policy_versions enable row level security;
alter table public.office_policy_acknowledgements enable row level security;
alter table public.office_announcements enable row level security;
alter table public.office_announcement_receipts enable row level security;
alter table public.office_knowledge_articles enable row level security;
alter table public.office_knowledge_versions enable row level security;
alter table public.office_policy_knowledge_events enable row level security;

revoke all on public.office_policies,public.office_policy_versions,public.office_policy_acknowledgements,public.office_announcements,public.office_announcement_receipts,public.office_knowledge_articles,public.office_knowledge_versions,public.office_policy_knowledge_events from public,anon,authenticated;
grant select,insert,update on public.office_policies,public.office_policy_versions,public.office_policy_acknowledgements,public.office_announcements,public.office_announcement_receipts,public.office_knowledge_articles,public.office_knowledge_versions to service_role;
grant select,insert on public.office_policy_knowledge_events to service_role;

create or replace function public.office_policy_create(p_actor uuid,p_title text,p_category text,p_audience_type text,p_audience_key text,p_ack boolean,p_owner uuid,p_content text,p_effective date,p_change_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_policy uuid; v_version uuid; v_audience text:=upper(trim(p_audience_type)); v_hash text;
begin
 if not public.office_effective_permission(p_actor,'policy.manage','COMPANY',null,null) then raise exception 'Policy management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active policy owner is required'; end if;
 if v_audience not in ('COMPANY','DEPARTMENT','ROLE') then raise exception 'Invalid policy audience'; end if;
 if v_audience<>'COMPANY' and nullif(trim(coalesce(p_audience_key,'')),'') is null then raise exception 'Audience key is required'; end if;
 v_hash:=encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex');
 insert into public.office_policies(title,category,audience_type,audience_key,acknowledgement_required,owner_user_id,created_by)
 values(trim(p_title),upper(trim(p_category)),v_audience,case when v_audience='COMPANY' then null else upper(trim(p_audience_key)) end,coalesce(p_ack,true),p_owner,p_actor)
 returning id into v_policy;
 insert into public.office_policy_versions(policy_id,version,content_text,effective_on,change_summary,created_by,content_sha256)
 values(v_policy,1,trim(p_content),p_effective,nullif(trim(coalesce(p_change_summary,'')),''),p_actor,v_hash) returning id into v_version;
 insert into public.office_policy_knowledge_events(actor_user_id,policy_id,policy_version_id,event_type) values(p_actor,v_policy,v_version,'POLICY_CREATED');
 return v_policy;
end; $$;

create or replace function public.office_policy_new_version(p_actor uuid,p_policy uuid,p_content text,p_effective date,p_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_policies%rowtype; v_version integer; v_id uuid; v_hash text;
begin
 if not public.office_effective_permission(p_actor,'policy.manage','COMPANY',null,null) then raise exception 'Policy management permission is required'; end if;
 select * into p from public.office_policies where id=p_policy for update;
 if p.id is null or p.status='RETIRED' then raise exception 'Active policy record is required'; end if;
 select coalesce(max(version),0)+1 into v_version from public.office_policy_versions where policy_id=p.id;
 v_hash:=encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex');
 insert into public.office_policy_versions(policy_id,version,content_text,effective_on,change_summary,created_by,content_sha256)
 values(p.id,v_version,trim(p_content),p_effective,nullif(trim(coalesce(p_summary,'')),''),p_actor,v_hash) returning id into v_id;
 insert into public.office_policy_knowledge_events(actor_user_id,policy_id,policy_version_id,event_type,metadata) values(p_actor,p.id,v_id,'POLICY_VERSION_CREATED',jsonb_build_object('version',v_version));
 return v_id;
end; $$;

create or replace function public.office_policy_publish(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_policy_versions%rowtype; p public.office_policies%rowtype;
begin
 if not public.office_effective_permission(p_actor,'policy.publish','COMPANY',null,null) then raise exception 'Policy publishing permission is required'; end if;
 select * into v from public.office_policy_versions where id=p_version for update;
 if v.id is null or v.status<>'DRAFT' then raise exception 'Draft policy version is required'; end if;
 select * into p from public.office_policies where id=v.policy_id for update;
 if p_actor=v.created_by then raise exception 'Policy version creator cannot independently publish the same version'; end if;
 update public.office_policy_versions set status='SUPERSEDED' where policy_id=p.id and status='PUBLISHED';
 update public.office_policy_versions set status='PUBLISHED',published_by=p_actor,published_at=now() where id=v.id;
 update public.office_policies set status='PUBLISHED',current_version=v.version,updated_at=now() where id=p.id;
 insert into public.office_policy_knowledge_events(actor_user_id,policy_id,policy_version_id,event_type,metadata) values(p_actor,p.id,v.id,'POLICY_PUBLISHED',jsonb_build_object('version',v.version));
 return true;
end; $$;

create or replace function public.office_policy_acknowledge(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_policy_versions%rowtype; p public.office_policies%rowtype; dept text; has_role boolean;
begin
 if not public.office_effective_permission(p_actor,'policy.read','COMPANY',null,null) then raise exception 'Policy read permission is required'; end if;
 select * into v from public.office_policy_versions where id=p_version and status='PUBLISHED';
 if v.id is null then raise exception 'Published policy version is required'; end if;
 select * into p from public.office_policies where id=v.policy_id and status='PUBLISHED';
 select primary_department into dept from public.office_identity_users where user_id=p_actor;
 has_role:=exists(select 1 from public.office_user_roles where user_id=p_actor and role=p.audience_key and (expires_at is null or expires_at>now()));
 if p.audience_type='DEPARTMENT' and upper(coalesce(dept,''))<>upper(p.audience_key) then raise exception 'Policy is outside actor audience'; end if;
 if p.audience_type='ROLE' and not has_role then raise exception 'Policy is outside actor audience'; end if;
 insert into public.office_policy_acknowledgements(policy_version_id,user_id) values(v.id,p_actor)
 on conflict(policy_version_id,user_id) do nothing;
 insert into public.office_policy_knowledge_events(actor_user_id,policy_id,policy_version_id,event_type) values(p_actor,p.id,v.id,'POLICY_ACKNOWLEDGED');
 return true;
end; $$;

create or replace function public.office_announcement_create(p_actor uuid,p_title text,p_body text,p_type text,p_audience_type text,p_audience_key text,p_ack boolean,p_priority text,p_expires timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; aud text:=upper(trim(p_audience_type));
begin
 if not public.office_effective_permission(p_actor,'announcement.manage','COMPANY',null,null) then raise exception 'Announcement management permission is required'; end if;
 if aud not in ('COMPANY','DEPARTMENT','ROLE') then raise exception 'Invalid announcement audience'; end if;
 if aud<>'COMPANY' and nullif(trim(coalesce(p_audience_key,'')),'') is null then raise exception 'Audience key is required'; end if;
 insert into public.office_announcements(title,body_text,announcement_type,audience_type,audience_key,requires_ack,priority,status,published_at,expires_at,created_by,published_by)
 values(trim(p_title),trim(p_body),upper(trim(p_type)),aud,case when aud='COMPANY' then null else upper(trim(p_audience_key)) end,coalesce(p_ack,false),upper(trim(p_priority)),'PUBLISHED',now(),p_expires,p_actor,p_actor)
 returning id into v_id;
 insert into public.office_policy_knowledge_events(actor_user_id,announcement_id,event_type) values(p_actor,v_id,'ANNOUNCEMENT_PUBLISHED');
 return v_id;
end; $$;

create or replace function public.office_announcement_receipt(p_actor uuid,p_announcement uuid,p_ack boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.office_announcements%rowtype; dept text; has_role boolean;
begin
 if not public.office_effective_permission(p_actor,'announcement.read','COMPANY',null,null) then raise exception 'Announcement read permission is required'; end if;
 select * into a from public.office_announcements where id=p_announcement and status='PUBLISHED' and (expires_at is null or expires_at>now());
 if a.id is null then raise exception 'Active published announcement is required'; end if;
 select primary_department into dept from public.office_identity_users where user_id=p_actor;
 has_role:=exists(select 1 from public.office_user_roles where user_id=p_actor and role=a.audience_key and (expires_at is null or expires_at>now()));
 if a.audience_type='DEPARTMENT' and upper(coalesce(dept,''))<>upper(a.audience_key) then raise exception 'Announcement is outside actor audience'; end if;
 if a.audience_type='ROLE' and not has_role then raise exception 'Announcement is outside actor audience'; end if;
 if a.requires_ack and not coalesce(p_ack,false) then raise exception 'Acknowledgement is required'; end if;
 insert into public.office_announcement_receipts(announcement_id,user_id,acknowledged_at) values(a.id,p_actor,case when coalesce(p_ack,false) then now() else null end)
 on conflict(announcement_id,user_id) do update set read_at=coalesce(public.office_announcement_receipts.read_at,now()),acknowledged_at=case when coalesce(p_ack,false) then coalesce(public.office_announcement_receipts.acknowledged_at,now()) else public.office_announcement_receipts.acknowledged_at end;
 insert into public.office_policy_knowledge_events(actor_user_id,announcement_id,event_type,metadata) values(p_actor,a.id,'ANNOUNCEMENT_RECEIPT',jsonb_build_object('acknowledged',coalesce(p_ack,false)));
 return true;
end; $$;

create or replace function public.office_knowledge_create(p_actor uuid,p_title text,p_category text,p_audience_type text,p_audience_key text,p_owner uuid,p_content text,p_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_article uuid; v_version uuid; aud text:=upper(trim(p_audience_type)); v_hash text;
begin
 if not public.office_effective_permission(p_actor,'knowledge.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'knowledge.manage','DEPARTMENT',p_audience_key,null) then raise exception 'Knowledge management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_owner and status='ACTIVE') then raise exception 'Active article owner is required'; end if;
 if aud not in ('COMPANY','DEPARTMENT','ROLE') then raise exception 'Invalid knowledge audience'; end if;
 v_hash:=encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex');
 insert into public.office_knowledge_articles(title,category,audience_type,audience_key,owner_user_id,created_by)
 values(trim(p_title),upper(trim(p_category)),aud,case when aud='COMPANY' then null else upper(trim(p_audience_key)) end,p_owner,p_actor) returning id into v_article;
 insert into public.office_knowledge_versions(article_id,version,content_text,change_summary,created_by,content_sha256)
 values(v_article,1,trim(p_content),nullif(trim(coalesce(p_summary,'')),''),p_actor,v_hash) returning id into v_version;
 insert into public.office_policy_knowledge_events(actor_user_id,article_id,article_version_id,event_type) values(p_actor,v_article,v_version,'KNOWLEDGE_CREATED');
 return v_article;
end; $$;

create or replace function public.office_knowledge_new_version(p_actor uuid,p_article uuid,p_content text,p_summary text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.office_knowledge_articles%rowtype; v integer; v_id uuid; v_hash text;
begin
 select * into a from public.office_knowledge_articles where id=p_article for update;
 if a.id is null or a.status='RETIRED' then raise exception 'Active knowledge article is required'; end if;
 if not public.office_effective_permission(p_actor,'knowledge.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'knowledge.manage','DEPARTMENT',a.audience_key,null) then raise exception 'Knowledge management permission is required'; end if;
 select coalesce(max(version),0)+1 into v from public.office_knowledge_versions where article_id=a.id;
 v_hash:=encode(extensions.digest(convert_to(p_content,'UTF8'),'sha256'),'hex');
 insert into public.office_knowledge_versions(article_id,version,content_text,change_summary,created_by,content_sha256)
 values(a.id,v,trim(p_content),nullif(trim(coalesce(p_summary,'')),''),p_actor,v_hash) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.office_knowledge_publish(p_actor uuid,p_version uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v public.office_knowledge_versions%rowtype; a public.office_knowledge_articles%rowtype; allowed boolean;
begin
 select * into v from public.office_knowledge_versions where id=p_version for update;
 if v.id is null or v.status<>'DRAFT' then raise exception 'Draft knowledge version is required'; end if;
 select * into a from public.office_knowledge_articles where id=v.article_id for update;
 allowed:=public.office_effective_permission(p_actor,'knowledge.publish','COMPANY',null,null)
   or public.office_effective_permission(p_actor,'knowledge.publish','DEPARTMENT',a.audience_key,null);
 if not allowed then raise exception 'Knowledge publishing permission is required'; end if;
 if p_actor=v.created_by then raise exception 'Knowledge version creator cannot independently publish the same version'; end if;
 update public.office_knowledge_versions set status='SUPERSEDED' where article_id=a.id and status='PUBLISHED';
 update public.office_knowledge_versions set status='PUBLISHED',published_by=p_actor,published_at=now() where id=v.id;
 update public.office_knowledge_articles set status='PUBLISHED',current_version=v.version,updated_at=now() where id=a.id;
 insert into public.office_policy_knowledge_events(actor_user_id,article_id,article_version_id,event_type,metadata) values(p_actor,a.id,v.id,'KNOWLEDGE_PUBLISHED',jsonb_build_object('version',v.version));
 return true;
end; $$;

revoke all on function public.office_policy_create(uuid,text,text,text,text,boolean,uuid,text,date,text) from public,anon,authenticated;
revoke all on function public.office_policy_new_version(uuid,uuid,text,date,text) from public,anon,authenticated;
revoke all on function public.office_policy_publish(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_policy_acknowledge(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_announcement_create(uuid,text,text,text,text,text,boolean,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_announcement_receipt(uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.office_knowledge_create(uuid,text,text,text,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_knowledge_new_version(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_knowledge_publish(uuid,uuid) from public,anon,authenticated;

grant execute on function public.office_policy_create(uuid,text,text,text,text,boolean,uuid,text,date,text) to service_role;
grant execute on function public.office_policy_new_version(uuid,uuid,text,date,text) to service_role;
grant execute on function public.office_policy_publish(uuid,uuid) to service_role;
grant execute on function public.office_policy_acknowledge(uuid,uuid) to service_role;
grant execute on function public.office_announcement_create(uuid,text,text,text,text,text,boolean,text,timestamptz) to service_role;
grant execute on function public.office_announcement_receipt(uuid,uuid,boolean) to service_role;
grant execute on function public.office_knowledge_create(uuid,text,text,text,text,uuid,text,text) to service_role;
grant execute on function public.office_knowledge_new_version(uuid,uuid,text,text) to service_role;
grant execute on function public.office_knowledge_publish(uuid,uuid) to service_role;
