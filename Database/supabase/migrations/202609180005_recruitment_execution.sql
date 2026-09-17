-- Complete the recruitment execution layer with controlled interview feedback,
-- candidate-document review and offer-document linkage. Candidate files stay in
-- a private storage bucket and never become public URLs.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('office-candidate-documents','office-candidate-documents',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.office_interview_schedule(p_actor uuid,p_candidate uuid,p_stage text,p_title text,p_interviewer uuid,p_start timestamptz,p_end timestamptz,p_location text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype; v_id uuid;
begin
 select * into c from public.office_candidates where id=p_candidate for update; if c.id is null or c.status in ('REJECTED','WITHDRAWN','DECLINED','HIRED') then raise exception 'Active candidate is required'; end if;
 select * into r from public.office_hiring_requisitions where id=c.requisition_id;
 if not public.office_effective_permission(p_actor,'hiring.interview.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.interview.manage','DEPARTMENT',r.department_code,null) then raise exception 'Interview management permission is required'; end if;
 if not exists(select 1 from public.office_identity_users where user_id=p_interviewer and status='ACTIVE') then raise exception 'Active interviewer is required'; end if;
 insert into public.office_candidate_interviews(candidate_id,stage_code,title,interviewer_user_id,scheduled_start,scheduled_end,location_or_link,created_by)
 values(c.id,upper(trim(p_stage)),trim(p_title),p_interviewer,p_start,p_end,nullif(trim(coalesce(p_location,'')),''),p_actor) returning id into v_id;
 update public.office_candidates set status='INTERVIEW',updated_at=now() where id=c.id and status in ('APPLIED','SCREENING','SELECTED');
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,metadata) values(p_actor,c.requisition_id,c.id,'INTERVIEW_SCHEDULED',jsonb_build_object('interview_id',v_id,'stage',upper(trim(p_stage)),'interviewer_user_id',p_interviewer,'scheduled_start',p_start));
 return v_id;
end; $$;

create or replace function public.office_interview_feedback_submit(p_actor uuid,p_interview uuid,p_outcome text,p_evidence text,p_strengths text,p_concerns text)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.office_candidate_interviews%rowtype; c public.office_candidates%rowtype; v_id uuid; outcome text:=upper(trim(p_outcome));
begin
 select * into i from public.office_candidate_interviews where id=p_interview for update; if i.id is null or i.status='CANCELLED' then raise exception 'Interview is unavailable'; end if;
 if i.interviewer_user_id<>p_actor and not public.office_effective_permission(p_actor,'hiring.interview.manage','COMPANY',null,null) then raise exception 'Assigned interviewer or hiring authority is required'; end if;
 if outcome not in ('STRONG_YES','YES','MIXED','NO','STRONG_NO') then raise exception 'Invalid interview outcome'; end if;
 insert into public.office_candidate_interview_feedback(interview_id,interviewer_user_id,outcome,evidence_note,strengths,concerns)
 values(i.id,p_actor,outcome,trim(p_evidence),nullif(trim(coalesce(p_strengths,'')),''),nullif(trim(coalesce(p_concerns,'')),''))
 on conflict(interview_id,interviewer_user_id) do update set outcome=excluded.outcome,evidence_note=excluded.evidence_note,strengths=excluded.strengths,concerns=excluded.concerns,submitted_at=now() returning id into v_id;
 update public.office_candidate_interviews set status='COMPLETED',updated_at=now() where id=i.id;
 select * into c from public.office_candidates where id=i.candidate_id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,metadata) values(p_actor,c.requisition_id,c.id,'INTERVIEW_FEEDBACK_SUBMITTED',jsonb_build_object('interview_id',i.id,'outcome',outcome,'feedback_id',v_id));
 return v_id;
end; $$;

create or replace function public.office_candidate_document_received(p_actor uuid,p_request uuid,p_storage text,p_source text)
returns text language plpgsql security definer set search_path='' as $$
declare d public.office_candidate_document_requests%rowtype; c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype;
begin
 select * into d from public.office_candidate_document_requests where id=p_request for update; if d.id is null then raise exception 'Candidate document request not found'; end if;
 select * into c from public.office_candidates where id=d.candidate_id; select * into r from public.office_hiring_requisitions where id=c.requisition_id;
 if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then raise exception 'Candidate document permission is required'; end if;
 if d.status in ('VERIFIED','WAIVED') then raise exception 'Finalized candidate document cannot be replaced silently'; end if;
 update public.office_candidate_document_requests set storage_reference=trim(p_storage),source_reference=nullif(trim(coalesce(p_source,'')),''),status='UNDER_REVIEW',verified_by=null,verified_at=null,updated_at=now() where id=d.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,metadata) values(p_actor,c.requisition_id,c.id,'CANDIDATE_DOCUMENT_RECEIVED',jsonb_build_object('request_id',d.id,'document_type',d.document_type,'storage_reference',trim(p_storage)));
 return 'UNDER_REVIEW';
end; $$;

create or replace function public.office_candidate_document_review(p_actor uuid,p_request uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare d public.office_candidate_document_requests%rowtype; c public.office_candidates%rowtype; r public.office_hiring_requisitions%rowtype; target text:=upper(trim(p_decision));
begin
 select * into d from public.office_candidate_document_requests where id=p_request for update; if d.id is null or d.status not in ('RECEIVED','UNDER_REVIEW','REJECTED') then raise exception 'Candidate document is not reviewable'; end if;
 select * into c from public.office_candidates where id=d.candidate_id; select * into r from public.office_hiring_requisitions where id=c.requisition_id;
 if not public.office_effective_permission(p_actor,'hiring.candidate.manage','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.candidate.manage','DEPARTMENT',r.department_code,null) then raise exception 'Candidate document permission is required'; end if;
 if target not in ('VERIFIED','REJECTED','WAIVED') then raise exception 'Invalid document review decision'; end if;
 if target='VERIFIED' and d.storage_reference is null then raise exception 'Received file is required before verification'; end if;
 update public.office_candidate_document_requests set status=target,verified_by=p_actor,verified_at=case when target in ('VERIFIED','WAIVED') then now() else null end,note=nullif(trim(coalesce(p_note,'')),''),updated_at=now() where id=d.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,event_type,metadata) values(p_actor,c.requisition_id,c.id,'CANDIDATE_DOCUMENT_REVIEWED',jsonb_build_object('request_id',d.id,'document_type',d.document_type,'decision',target));
 return target;
end; $$;

create or replace function public.office_offer_attach_document(p_actor uuid,p_offer uuid,p_document uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.office_offer_proposals%rowtype; d public.office_document_instances%rowtype;
begin
 select * into o from public.office_offer_proposals where id=p_offer for update; if o.id is null or o.status<>'APPROVED' then raise exception 'Approved offer proposal is required'; end if;
 if not public.office_effective_permission(p_actor,'hiring.offer.prepare','COMPANY',null,null) and not public.office_effective_permission(p_actor,'hiring.offer.prepare','DEPARTMENT',o.department_code,null) then raise exception 'Offer preparation permission is required'; end if;
 select * into d from public.office_document_instances where id=p_document; if d.id is null or d.status not in ('DRAFT','PENDING_APPROVAL','APPROVED','RENDERED','SIGNING','SIGNED') then raise exception 'Offer document instance is unavailable'; end if;
 if d.subject_type<>'CANDIDATE' or d.subject_reference<>o.candidate_id::text then raise exception 'Offer document subject mismatch'; end if;
 update public.office_offer_proposals set offer_document_instance_id=d.id,status='DOCUMENT_READY',updated_at=now() where id=o.id;
 insert into public.office_recruitment_events(actor_user_id,requisition_id,candidate_id,offer_id,event_type,metadata) values(p_actor,o.requisition_id,o.candidate_id,o.id,'OFFER_DOCUMENT_ATTACHED',jsonb_build_object('document_instance_id',d.id,'document_status',d.status));
 return true;
end; $$;

revoke all on function public.office_interview_schedule(uuid,uuid,text,text,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_interview_feedback_submit(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_candidate_document_received(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_candidate_document_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_offer_attach_document(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_interview_schedule(uuid,uuid,text,text,uuid,timestamptz,timestamptz,text) to service_role;
grant execute on function public.office_interview_feedback_submit(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_candidate_document_received(uuid,uuid,text,text) to service_role;
grant execute on function public.office_candidate_document_review(uuid,uuid,text,text) to service_role;
grant execute on function public.office_offer_attach_document(uuid,uuid,uuid) to service_role;
