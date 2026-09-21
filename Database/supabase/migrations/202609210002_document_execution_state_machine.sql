-- KRAVIA Office — controlled document signature evidence and delivery state machine.
-- External eSign/DSC providers remain adapters; the canonical Office workflow is
-- usable with verified signed-PDF evidence before any provider is connected.

insert into public.office_permission_catalog
  (code,module,action,label,description,sensitivity,high_risk,requires_managed_device,active)
values
  ('document.signature.record','DOCUMENTS','RECORD_SIGNATURE','Record signed document evidence','Upload and record verified signed-PDF evidence for an approved/rendered controlled document.','HIGH',true,true,true),
  ('document.delivery.record','DOCUMENTS','RECORD_DELIVERY','Record document delivery','Record controlled delivery evidence for a rendered or signed document.','HIGH',true,true,true)
on conflict(code) do update
set module=excluded.module,
    action=excluded.action,
    label=excluded.label,
    description=excluded.description,
    sensitivity=excluded.sensitivity,
    high_risk=excluded.high_risk,
    requires_managed_device=excluded.requires_managed_device,
    active=true;

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type)
values
  ('CS_SECRETARIAL','document.signature.record','ALLOW','COMPANY'),
  ('LEGAL_COUNSEL','document.signature.record','ALLOW','COMPANY'),
  ('HR_MANAGER','document.delivery.record','ALLOW','DEPARTMENT'),
  ('CS_SECRETARIAL','document.delivery.record','ALLOW','COMPANY'),
  ('LEGAL_COUNSEL','document.delivery.record','ALLOW','COMPANY'),
  ('FINANCE_MANAGER','document.delivery.record','ALLOW','COMPANY'),
  ('SALES_MANAGER','document.delivery.record','ALLOW','DEPARTMENT'),
  ('OPERATIONS_MANAGER','document.delivery.record','ALLOW','DEPARTMENT')
on conflict(profile_code,permission_code) do update
set effect=excluded.effect,
    default_scope_type=excluded.default_scope_type;

create table if not exists public.office_document_signature_evidence(
  id uuid primary key default gen_random_uuid(),
  document_instance_id uuid not null references public.office_document_instances(id) on delete restrict,
  source_render_id uuid not null references public.office_document_renders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  signature_method text not null check(signature_method in ('ESIGN','DSC','WET_SIGNATURE','OTHER')),
  signer_reference_masked text,
  signed_storage_reference text not null,
  signed_sha256 text not null check(char_length(signed_sha256)=64),
  byte_size bigint not null check(byte_size>0),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'VERIFIED' check(status in ('VERIFIED','SUPERSEDED','ARCHIVED')),
  signed_at timestamptz not null,
  recorded_by uuid not null references public.office_identity_users(user_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique(document_instance_id,signed_sha256)
);

create index if not exists office_document_signature_instance_idx
  on public.office_document_signature_evidence(document_instance_id,status,recorded_at desc);

alter table public.office_document_signature_evidence enable row level security;
revoke all on public.office_document_signature_evidence from public,anon,authenticated;
grant select,insert,update on public.office_document_signature_evidence to service_role;

create or replace function public.office_document_record_signature(
  p_actor uuid,
  p_instance uuid,
  p_render uuid,
  p_provider text,
  p_provider_reference text,
  p_method text,
  p_signer_masked text,
  p_storage text,
  p_sha text,
  p_size bigint,
  p_signed_at timestamptz,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.office_document_instances%rowtype;
  r public.office_document_renders%rowtype;
  v_id uuid;
  v_method text:=upper(trim(coalesce(p_method,'')));
  v_provider text:=upper(trim(coalesce(p_provider,'')));
begin
  select * into d from public.office_document_instances where id=p_instance for update;
  if d.id is null or d.status not in ('RENDERED','SIGNING','SIGNED') then
    raise exception 'Rendered document instance is required before signature evidence';
  end if;

  select * into r from public.office_document_renders where id=p_render and document_instance_id=d.id;
  if r.id is null or r.output_format<>'PDF' then
    raise exception 'A PDF source render is required for signature evidence';
  end if;

  if not public.office_effective_permission(p_actor,'document.signature.record','COMPANY',null,null)
     and not public.office_effective_permission(p_actor,'document.signature.record','OWN',null,d.owner_user_id) then
    raise exception 'Document signature-record permission is required';
  end if;

  if v_provider='' or v_method not in ('ESIGN','DSC','WET_SIGNATURE','OTHER') then
    raise exception 'Valid signature provider and method are required';
  end if;
  if p_storage is null or btrim(p_storage)='' or p_sha is null or char_length(p_sha)<>64 or p_size<=0 then
    raise exception 'Signed document storage, SHA-256 and size evidence are required';
  end if;
  if p_signed_at is null or p_signed_at > now() + interval '5 minutes' then
    raise exception 'Valid signature timestamp is required';
  end if;

  update public.office_document_signature_evidence
     set status='SUPERSEDED'
   where document_instance_id=d.id and status='VERIFIED';

  insert into public.office_document_signature_evidence(
    document_instance_id,source_render_id,provider,provider_reference,signature_method,
    signer_reference_masked,signed_storage_reference,signed_sha256,byte_size,evidence,
    signed_at,recorded_by
  ) values (
    d.id,r.id,v_provider,nullif(trim(coalesce(p_provider_reference,'')),''),
    v_method,nullif(trim(coalesce(p_signer_masked,'')),''),
    trim(p_storage),lower(trim(p_sha)),p_size,coalesce(p_evidence,'{}'::jsonb),
    p_signed_at,p_actor
  ) returning id into v_id;

  update public.office_document_instances
     set status='SIGNED',signed_at=p_signed_at,updated_at=now()
   where id=d.id;

  insert into public.office_document_delivery_events(
    document_instance_id,render_id,channel,destination_masked,provider_reference,
    event_type,metadata,actor_user_id
  ) values (
    d.id,r.id,'ESIGN',nullif(trim(coalesce(p_signer_masked,'')),''),
    nullif(trim(coalesce(p_provider_reference,'')),''),
    'SIGNATURE_RECORDED',
    jsonb_build_object(
      'signature_evidence_id',v_id,
      'provider',v_provider,
      'method',v_method,
      'signed_sha256',lower(trim(p_sha)),
      'signed_storage_reference',trim(p_storage)
    ) || coalesce(p_evidence,'{}'::jsonb),
    p_actor
  );

  insert into public.office_document_engine_events(
    actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata
  ) values (
    p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_SIGNED',
    jsonb_build_object(
      'signature_evidence_id',v_id,
      'source_render_id',r.id,
      'provider',v_provider,
      'method',v_method,
      'signed_sha256',lower(trim(p_sha))
    )
  );

  return v_id;
end; $$;

create or replace function public.office_document_record_delivery(
  p_actor uuid,
  p_instance uuid,
  p_render uuid,
  p_channel text,
  p_destination_masked text,
  p_provider_reference text,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.office_document_instances%rowtype;
  r public.office_document_renders%rowtype;
  v_id uuid;
  v_channel text:=upper(trim(coalesce(p_channel,'')));
  v_event text:=upper(trim(coalesce(p_event_type,'')));
begin
  select * into d from public.office_document_instances where id=p_instance for update;
  if d.id is null or d.status not in ('RENDERED','SIGNED','DELIVERED') then
    raise exception 'Rendered or signed document is required before delivery';
  end if;

  select * into r from public.office_document_renders where id=p_render and document_instance_id=d.id;
  if r.id is null then raise exception 'Document output does not belong to the selected instance'; end if;

  if not public.office_effective_permission(p_actor,'document.delivery.record','COMPANY',null,null)
     and not public.office_effective_permission(p_actor,'document.delivery.record','OWN',null,d.owner_user_id) then
    raise exception 'Document delivery-record permission is required';
  end if;

  if v_channel not in ('EMAIL','SMS','SECURE_LINK','IN_APP','ESIGN','OTHER') then
    raise exception 'Unsupported delivery channel';
  end if;
  if v_event='' then raise exception 'Delivery event type is required'; end if;

  insert into public.office_document_delivery_events(
    document_instance_id,render_id,channel,destination_masked,provider_reference,
    event_type,metadata,actor_user_id
  ) values (
    d.id,r.id,v_channel,nullif(trim(coalesce(p_destination_masked,'')),''),
    nullif(trim(coalesce(p_provider_reference,'')),''),
    v_event,coalesce(p_metadata,'{}'::jsonb),p_actor
  ) returning id into v_id;

  update public.office_document_instances
     set status='DELIVERED',delivered_at=coalesce(delivered_at,now()),updated_at=now()
   where id=d.id;

  insert into public.office_document_engine_events(
    actor_user_id,template_id,template_version_id,document_instance_id,event_type,metadata
  ) values (
    p_actor,d.template_id,d.template_version_id,d.id,'DOCUMENT_DELIVERED',
    jsonb_build_object(
      'delivery_event_id',v_id,
      'render_id',r.id,
      'channel',v_channel,
      'provider_reference',nullif(trim(coalesce(p_provider_reference,'')),'')
    ) || coalesce(p_metadata,'{}'::jsonb)
  );

  return v_id;
end; $$;

revoke all on function public.office_document_record_signature(uuid,uuid,uuid,text,text,text,text,text,text,bigint,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.office_document_record_delivery(uuid,uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;

grant execute on function public.office_document_record_signature(uuid,uuid,uuid,text,text,text,text,text,text,bigint,timestamptz,jsonb) to service_role;
grant execute on function public.office_document_record_delivery(uuid,uuid,uuid,text,text,text,text,jsonb) to service_role;
