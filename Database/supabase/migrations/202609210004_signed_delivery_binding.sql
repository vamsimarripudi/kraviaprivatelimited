-- KRAVIA Office — bind delivery evidence to the verified signed artifact when
-- the document has reached SIGNED state.

alter table public.office_document_delivery_events
  add column if not exists signature_evidence_id uuid
  references public.office_document_signature_evidence(id) on delete restrict;

create index if not exists office_document_delivery_signature_idx
  on public.office_document_delivery_events(signature_evidence_id)
  where signature_evidence_id is not null;

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
  v_signature uuid;
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

  if d.status in ('SIGNED','DELIVERED') then
    select id into v_signature
      from public.office_document_signature_evidence
     where document_instance_id=d.id and status='VERIFIED'
     order by recorded_at desc
     limit 1;
    if v_signature is null then
      raise exception 'Signed document delivery requires verified signature evidence';
    end if;
  end if;

  insert into public.office_document_delivery_events(
    document_instance_id,render_id,signature_evidence_id,channel,destination_masked,
    provider_reference,event_type,metadata,actor_user_id
  ) values (
    d.id,r.id,v_signature,v_channel,nullif(trim(coalesce(p_destination_masked,'')),''),
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
      'signature_evidence_id',v_signature,
      'channel',v_channel,
      'provider_reference',nullif(trim(coalesce(p_provider_reference,'')),'')
    ) || coalesce(p_metadata,'{}'::jsonb)
  );

  return v_id;
end; $$;

revoke all on function public.office_document_record_delivery(uuid,uuid,uuid,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.office_document_record_delivery(uuid,uuid,uuid,text,text,text,text,jsonb)
  to service_role;
