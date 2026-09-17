-- Qualify pgcrypto calls explicitly because the board SECURITY DEFINER functions
-- intentionally run with an empty search_path.

create or replace function public.office_board_lock_minutes(p_actor uuid,p_minutes uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare v public.office_board_minutes_versions%rowtype; v_hash text;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.minutes.lock') then raise exception 'Minutes lock permission is required'; end if;
  select * into v from public.office_board_minutes_versions where id=p_minutes for update;
  if v.id is null or v.status<>'APPROVED' or v.approved_by is null then raise exception 'Independently approved minutes are required before lock'; end if;
  if exists(select 1 from public.office_board_minutes_versions where meeting_id=v.meeting_id and status='LOCKED') then raise exception 'Meeting already has locked minutes'; end if;
  v_hash:=encode(extensions.digest(convert_to(v.body,'UTF8'),'sha256'),'hex');
  update public.office_board_minutes_versions set status='LOCKED',content_hash=v_hash,locked_by=p_actor,locked_at=now(),updated_at=now() where id=p_minutes;
  update public.office_board_meetings set status='MINUTES_LOCKED',minutes_locked_at=now(),updated_by=p_actor,updated_at=now() where id=v.meeting_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,previous_status,new_status,metadata)
  values(v.meeting_id,p_actor,'MINUTES_LOCKED','MINUTES',p_minutes,'APPROVED','LOCKED',jsonb_build_object('sha256',v_hash));
  return v_hash;
end; $$;

create or replace function public.office_board_record_resolution(
  p_actor uuid,p_item uuid,p_type text,p_title text,p_text text,p_approval_basis text,p_approved_by_name text,p_source_reference text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare a public.office_board_agenda_items%rowtype; m public.office_board_meetings%rowtype; v_id uuid; v_hash text;
begin
  if not public.office_board_has_permission(p_actor,'secretarial.resolution.record') then raise exception 'Resolution-record permission is required'; end if;
  select * into a from public.office_board_agenda_items where id=p_item;
  if a.id is null or a.status<>'DECIDED' then raise exception 'A decided agenda item is required'; end if;
  select * into m from public.office_board_meetings where id=a.meeting_id;
  if m.status not in ('COMPLETED','MINUTES_DRAFTED','MINUTES_LOCKED') then raise exception 'Meeting must be completed before resolution record'; end if;
  v_hash:=encode(extensions.digest(convert_to(trim(p_text),'UTF8'),'sha256'),'hex');
  insert into public.office_board_resolutions(meeting_id,agenda_item_id,resolution_type,title,resolution_text,approval_basis,approved_by_name,recorded_by,content_hash,source_reference)
  values(a.meeting_id,p_item,upper(trim(p_type)),trim(p_title),trim(p_text),trim(p_approval_basis),nullif(trim(coalesce(p_approved_by_name,'')),''),p_actor,v_hash,nullif(trim(coalesce(p_source_reference,'')),''))
  returning id into v_id;
  insert into public.office_board_events(meeting_id,actor_user_id,event_type,entity_type,entity_id,new_status,metadata)
  values(a.meeting_id,p_actor,'RESOLUTION_RECORDED','RESOLUTION',v_id,'RECORDED',jsonb_build_object('sha256',v_hash));
  return v_id;
end; $$;

revoke all on function public.office_board_lock_minutes(uuid,uuid) from public,anon,authenticated;
revoke all on function public.office_board_record_resolution(uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.office_board_lock_minutes(uuid,uuid) to service_role;
grant execute on function public.office_board_record_resolution(uuid,uuid,text,text,text,text,text,text) to service_role;
