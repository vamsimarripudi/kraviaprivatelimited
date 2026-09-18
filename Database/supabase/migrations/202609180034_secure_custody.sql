-- KRAVIA Office OS — secure custody for physical originals, DSC tokens and restricted media.
-- Extends ordinary asset handling with controlled custody; no signing PIN, private key or token secret is stored.

insert into public.office_permission_catalog(code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active) values
 ('custody.read','ADMIN','READ_CUSTODY','Read secure custody','Read secure-custody records for physical originals and restricted assets.','SENSITIVE',false,true,true),
 ('custody.manage','ADMIN','MANAGE_CUSTODY','Manage secure custody','Create custody records and assign storage/custodian metadata.','CRITICAL',true,true,true),
 ('custody.checkout','ADMIN','CHECKOUT_CUSTODY','Checkout secure item','Check out a restricted physical item for an authorised purpose.','CRITICAL',true,true,true),
 ('custody.review','ADMIN','REVIEW_CUSTODY','Review secure custody','Independently verify return, loss or disposal evidence.','CRITICAL',true,true,true)
on conflict(code) do update set module=excluded.module,action=excluded.action,label=excluded.label,description=excluded.description,sensitivity=excluded.sensitivity,high_risk=excluded.high_risk,requires_managed_device=excluded.requires_managed_device,active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('OFFICE_ADMIN','custody.read','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','custody.manage','ALLOW','COMPANY'),
 ('OFFICE_ADMIN','custody.checkout','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','custody.read','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','custody.manage','ALLOW','COMPANY'),
 ('CS_SECRETARIAL','custody.checkout','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','custody.read','ALLOW','COMPANY'),
 ('LEGAL_COUNSEL','custody.checkout','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','custody.read','ALLOW','COMPANY'),
 ('SECURITY_OPERATOR','custody.review','ALLOW','COMPANY'),
 ('AUDITOR_READONLY','custody.read','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create sequence if not exists public.office_secure_custody_seq;
create sequence if not exists public.office_secure_checkout_seq;
grant usage,select on sequence public.office_secure_custody_seq,public.office_secure_checkout_seq to service_role;

create table if not exists public.office_secure_custody_items(
 id uuid primary key default gen_random_uuid(),
 custody_code text not null unique default ('KR-CUS-'||lpad(nextval('public.office_secure_custody_seq')::text,7,'0')),
 item_type text not null check(item_type in ('DSC_TOKEN','ORIGINAL_DOCUMENT','SHARE_CERTIFICATE','BANK_DOCUMENT','GOVERNMENT_CERTIFICATE','SECURITY_TOKEN','BACKUP_MEDIA','OTHER')),
 title text not null check(char_length(trim(title)) between 3 and 220),
 reference_no text,
 linked_asset_id varchar,
 document_reference text,
 current_custodian_user_id uuid references public.office_identity_users(user_id) on delete restrict,
 storage_location text not null,
 classification text not null default 'RESTRICTED' check(classification in ('CONFIDENTIAL','RESTRICTED','LEGAL','BOARD','SECURITY')),
 status text not null default 'IN_CUSTODY' check(status in ('IN_CUSTODY','CHECKED_OUT','LOST','DAMAGED','DISPOSED','RETIRED')),
 notes text check(notes is null or char_length(notes)<=4000),
 created_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 reviewed_by uuid references public.office_identity_users(user_id) on delete restrict,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_secure_custody_status_idx on public.office_secure_custody_items(status,item_type);
create index if not exists office_secure_custody_custodian_idx on public.office_secure_custody_items(current_custodian_user_id,status);

create table if not exists public.office_secure_custody_checkouts(
 id uuid primary key default gen_random_uuid(),
 checkout_code text not null unique default ('KR-COUT-'||lpad(nextval('public.office_secure_checkout_seq')::text,7,'0')),
 item_id uuid not null references public.office_secure_custody_items(id) on delete restrict,
 checked_out_to_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 purpose text not null check(char_length(trim(purpose)) between 3 and 4000),
 related_reference text,
 checked_out_by uuid not null references public.office_identity_users(user_id) on delete restrict,
 checked_out_at timestamptz not null default now(),
 due_back_at timestamptz,
 status text not null default 'OPEN' check(status in ('OPEN','RETURNED','OVERDUE','LOST')),
 returned_at timestamptz,
 return_evidence_reference text,
 return_verified_by uuid references public.office_identity_users(user_id) on delete restrict,
 return_verified_at timestamptz,
 loss_evidence_reference text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists office_secure_checkout_item_idx on public.office_secure_custody_checkouts(item_id,status,due_back_at);
create index if not exists office_secure_checkout_user_idx on public.office_secure_custody_checkouts(checked_out_to_user_id,status,due_back_at);

create table if not exists public.office_secure_custody_events(
 id bigint generated always as identity primary key,
 item_id uuid not null references public.office_secure_custody_items(id) on delete restrict,
 checkout_id uuid references public.office_secure_custody_checkouts(id) on delete restrict,
 actor_user_id uuid not null references public.office_identity_users(user_id) on delete restrict,
 event_type text not null,
 previous_status text,
 new_status text,
 note text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.office_secure_custody_items enable row level security;
alter table public.office_secure_custody_checkouts enable row level security;
alter table public.office_secure_custody_events enable row level security;
revoke all on public.office_secure_custody_items,public.office_secure_custody_checkouts,public.office_secure_custody_events from public,anon,authenticated;
grant select,insert,update on public.office_secure_custody_items,public.office_secure_custody_checkouts to service_role;
grant select,insert on public.office_secure_custody_events to service_role;

create or replace function public.office_secure_custody_create(
 p_actor uuid,p_type text,p_title text,p_reference text,p_asset varchar,p_document text,p_custodian uuid,p_location text,p_classification text,p_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'custody.manage','COMPANY',null,null) then raise exception 'Secure-custody management permission is required'; end if;
 if p_custodian is not null and not exists(select 1 from public.office_identity_users where user_id=p_custodian and status='ACTIVE') then raise exception 'Active custodian is required'; end if;
 if p_asset is not null and not exists(select 1 from public.assets where id=p_asset) then raise exception 'Linked canonical asset not found'; end if;
 insert into public.office_secure_custody_items(item_type,title,reference_no,linked_asset_id,document_reference,current_custodian_user_id,storage_location,classification,notes,created_by)
 values(upper(trim(p_type)),trim(p_title),nullif(trim(coalesce(p_reference,'')),''),p_asset,nullif(trim(coalesce(p_document,'')),''),p_custodian,trim(p_location),upper(trim(p_classification)),nullif(trim(coalesce(p_notes,'')),''),p_actor)
 returning id into v_id;
 insert into public.office_secure_custody_events(item_id,actor_user_id,event_type,new_status,note) values(v_id,p_actor,'CUSTODY_ITEM_CREATED','IN_CUSTODY','No PIN, signing private key or token secret is stored in this record.');
 return v_id;
end; $$;

create or replace function public.office_secure_custody_checkout(
 p_actor uuid,p_item uuid,p_to uuid,p_purpose text,p_related text,p_due timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.office_secure_custody_items%rowtype; v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'custody.checkout','COMPANY',null,null) then raise exception 'Secure-item checkout permission is required'; end if;
 select * into i from public.office_secure_custody_items where id=p_item for update;
 if i.id is null or i.status<>'IN_CUSTODY' then raise exception 'Item currently in custody is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_to and status='ACTIVE') then raise exception 'Active checkout recipient is required'; end if;
 insert into public.office_secure_custody_checkouts(item_id,checked_out_to_user_id,purpose,related_reference,checked_out_by,due_back_at)
 values(i.id,p_to,trim(p_purpose),nullif(trim(coalesce(p_related,'')),''),p_actor,p_due) returning id into v_id;
 update public.office_secure_custody_items set status='CHECKED_OUT',current_custodian_user_id=p_to,updated_at=now() where id=i.id;
 insert into public.office_secure_custody_events(item_id,checkout_id,actor_user_id,event_type,previous_status,new_status,metadata) values(i.id,v_id,p_actor,'ITEM_CHECKED_OUT',i.status,'CHECKED_OUT',jsonb_build_object('checked_out_to',p_to,'due_back_at',p_due));
 return v_id;
end; $$;

create or replace function public.office_secure_custody_return(
 p_actor uuid,p_checkout uuid,p_evidence text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_secure_custody_checkouts%rowtype; i public.office_secure_custody_items%rowtype;
begin
 select * into c from public.office_secure_custody_checkouts where id=p_checkout for update;
 if c.id is null or c.status not in ('OPEN','OVERDUE') then raise exception 'Open/overdue secure checkout is required'; end if;
 select * into i from public.office_secure_custody_items where id=c.item_id for update;
 if p_actor<>c.checked_out_to_user_id and not public.office_effective_permission(p_actor,'custody.checkout','COMPANY',null,null) then raise exception 'Recipient or custody authority is required to record return'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Return evidence is required'; end if;
 update public.office_secure_custody_checkouts set status='RETURNED',returned_at=now(),return_evidence_reference=trim(p_evidence),updated_at=now() where id=c.id;
 update public.office_secure_custody_items set status='IN_CUSTODY',current_custodian_user_id=null,updated_at=now() where id=i.id;
 insert into public.office_secure_custody_events(item_id,checkout_id,actor_user_id,event_type,previous_status,new_status,metadata) values(i.id,c.id,p_actor,'RETURN_RECORDED',i.status,'IN_CUSTODY',jsonb_build_object('return_evidence_reference',trim(p_evidence),'verification_pending',true));
 return 'RETURNED';
end; $$;

create or replace function public.office_secure_custody_verify_return(
 p_actor uuid,p_checkout uuid,p_evidence text
) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.office_secure_custody_checkouts%rowtype;
begin
 if not public.office_effective_permission(p_actor,'custody.review','COMPANY',null,null) then raise exception 'Independent custody review permission is required'; end if;
 select * into c from public.office_secure_custody_checkouts where id=p_checkout for update;
 if c.id is null or c.status<>'RETURNED' or c.return_verified_at is not null then raise exception 'Unverified returned checkout is required'; end if;
 if p_actor=c.checked_out_to_user_id or p_actor=c.checked_out_by then raise exception 'Checkout recipient/issuer cannot independently verify the same return'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Return verification evidence is required'; end if;
 update public.office_secure_custody_checkouts set return_verified_by=p_actor,return_verified_at=now(),updated_at=now() where id=c.id;
 insert into public.office_secure_custody_events(item_id,checkout_id,actor_user_id,event_type,note) values(c.item_id,c.id,p_actor,'RETURN_VERIFIED',left(trim(p_evidence),2000));
 return true;
end; $$;

create or replace function public.office_secure_custody_mark_lost(
 p_actor uuid,p_checkout uuid,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare c public.office_secure_custody_checkouts%rowtype; i public.office_secure_custody_items%rowtype;
begin
 if not public.office_effective_permission(p_actor,'custody.review','COMPANY',null,null) then raise exception 'Independent custody review permission is required'; end if;
 select * into c from public.office_secure_custody_checkouts where id=p_checkout for update;
 if c.id is null or c.status not in ('OPEN','OVERDUE') then raise exception 'Open/overdue secure checkout is required'; end if;
 select * into i from public.office_secure_custody_items where id=c.item_id for update;
 if p_actor=c.checked_out_to_user_id or p_actor=c.checked_out_by then raise exception 'Checkout recipient/issuer cannot independently declare the same item lost'; end if;
 if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Loss evidence/reference is required'; end if;
 update public.office_secure_custody_checkouts set status='LOST',loss_evidence_reference=trim(p_evidence),updated_at=now() where id=c.id;
 update public.office_secure_custody_items set status='LOST',updated_at=now() where id=i.id;
 insert into public.office_secure_custody_events(item_id,checkout_id,actor_user_id,event_type,previous_status,new_status,note,metadata) values(i.id,c.id,p_actor,'ITEM_MARKED_LOST',i.status,'LOST',left(p_note,2000),jsonb_build_object('loss_evidence_reference',trim(p_evidence)));
 return 'LOST';
end; $$;

revoke all on function public.office_secure_custody_create(uuid,text,text,text,varchar,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.office_secure_custody_checkout(uuid,uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.office_secure_custody_return(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_secure_custody_verify_return(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_secure_custody_mark_lost(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_secure_custody_create(uuid,text,text,text,varchar,text,uuid,text,text,text) to service_role;
grant execute on function public.office_secure_custody_checkout(uuid,uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.office_secure_custody_return(uuid,uuid,text) to service_role;
grant execute on function public.office_secure_custody_verify_return(uuid,uuid,text) to service_role;
grant execute on function public.office_secure_custody_mark_lost(uuid,uuid,text,text) to service_role;
