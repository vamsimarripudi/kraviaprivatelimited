-- Phase 3 RLS policies. All use active identity checks; source records remain denied when no policy matches.
create or replace function public.can_read_document(p_document_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.corporate_documents d where d.id = p_document_id and (
    public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])
    or (d.classification in ('INTERNAL','CONFIDENTIAL') and public.has_active_corporate_role(array['LEGAL_REVIEWER','FINANCE_REVIEWER','COMPLIANCE_REVIEWER']::public.corporate_role[]))
    or public.has_resource_assignment('DOCUMENT', d.id, 'VIEW')
  ))
$$;
create or replace function public.can_access_board() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])
$$;
create or replace function public.can_manage_board() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])
$$;
create or replace function public.can_access_compliance() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','CA','AUDITOR','FINANCE_REVIEWER','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])
$$;
create or replace function public.can_manage_compliance() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','CA','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])
$$;
revoke all on function public.can_read_document(uuid) from public; grant execute on function public.can_read_document(uuid) to authenticated;
revoke all on function public.can_access_board() from public; grant execute on function public.can_access_board() to authenticated;
revoke all on function public.can_manage_board() from public; grant execute on function public.can_manage_board() to authenticated;
revoke all on function public.can_access_compliance() from public; grant execute on function public.can_access_compliance() to authenticated;
revoke all on function public.can_manage_compliance() from public; grant execute on function public.can_manage_compliance() to authenticated;

drop policy if exists "private storage scoped read" on storage.objects;
create policy "private storage classification read" on storage.objects for select to authenticated using (
  bucket_id = 'corporate-private' and exists(
    select 1 from public.corporate_documents d where d.storage_path = name and public.can_read_document(d.id)
  )
);

create policy "role assignments admin manage" on public.corporate_role_assignments for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "resource assignments admin manage" on public.resource_assignments for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "regulatory sources compliance read" on public.regulatory_sources for select to authenticated using (public.can_access_compliance());
create policy "regulatory sources controlled write" on public.regulatory_sources for all to authenticated using (public.has_active_corporate_role(array['CORPORATE_ADMIN','COMPANY_SECRETARY','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['CORPORATE_ADMIN','COMPANY_SECRETARY','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "compliance rules read" on public.compliance_rules for select to authenticated using (public.can_access_compliance());
create policy "compliance rules write" on public.compliance_rules for all to authenticated using (public.can_manage_compliance()) with check (public.can_manage_compliance());
create policy "compliance rule versions read" on public.compliance_rule_versions for select to authenticated using (public.can_access_compliance());
create policy "compliance rule versions write" on public.compliance_rule_versions for all to authenticated using (public.can_manage_compliance()) with check (public.can_manage_compliance());
create policy "applicability profile read" on public.company_applicability_profiles for select to authenticated using (public.can_access_compliance());
create policy "applicability profile write" on public.company_applicability_profiles for all to authenticated using (public.can_manage_compliance()) with check (public.can_manage_compliance());
create policy "obligations scoped read" on public.compliance_obligations for select to authenticated using (public.can_access_compliance() or owner_id = auth.uid() or reviewer_id = auth.uid());
create policy "obligations controlled write" on public.compliance_obligations for all to authenticated using (public.can_manage_compliance()) with check (public.can_manage_compliance());
create policy "compliance overrides read" on public.compliance_overrides for select to authenticated using (public.can_access_compliance());
create policy "compliance overrides write" on public.compliance_overrides for insert to authenticated with check (public.can_manage_compliance() and created_by = auth.uid());
create policy "compliance evidence read" on public.compliance_evidence for select to authenticated using (public.can_access_compliance());
create policy "compliance evidence write" on public.compliance_evidence for all to authenticated using (public.can_manage_compliance()) with check (public.can_manage_compliance());

create policy "notices board read" on public.meeting_notices for select to authenticated using (public.can_access_board());
create policy "notices board write" on public.meeting_notices for all to authenticated using (public.can_manage_board()) with check (public.can_manage_board());
create policy "notice deliveries board read" on public.notice_deliveries for select to authenticated using (public.can_access_board());
create policy "notice deliveries board write" on public.notice_deliveries for all to authenticated using (public.can_manage_board()) with check (public.can_manage_board());
create policy "attendance board read" on public.meeting_attendees for select to authenticated using (public.can_access_board());
create policy "attendance board write" on public.meeting_attendees for all to authenticated using (public.can_manage_board()) with check (public.can_manage_board());
create policy "minutes board read" on public.meeting_minutes_versions for select to authenticated using (public.can_access_board());
create policy "minutes draft controlled write" on public.meeting_minutes_versions for insert to authenticated with check (public.can_manage_board() and created_by = auth.uid());
create policy "minutes controlled update" on public.meeting_minutes_versions for update to authenticated using (public.can_manage_board() and status <> 'LOCKED') with check (public.can_manage_board());
create policy "minutes comments board read" on public.minutes_comments for select to authenticated using (public.can_access_board());
create policy "minutes comments board write" on public.minutes_comments for insert to authenticated with check (public.can_access_board() and author_id = auth.uid());
create policy "actions board read" on public.board_action_items for select to authenticated using (public.can_access_board() or owner_id = auth.uid());
create policy "actions board write" on public.board_action_items for all to authenticated using (public.can_manage_board()) with check (public.can_manage_board());
create policy "votes director read" on public.resolution_votes for select to authenticated using (public.can_access_board());
create policy "votes own insert" on public.resolution_votes for insert to authenticated with check (director_id = auth.uid() and public.has_active_corporate_role(array['DIRECTOR']::public.corporate_role[]));

create policy "retention policy read" on public.retention_policies for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','LEGAL_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "retention policy write" on public.retention_policies for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','LEGAL_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','LEGAL_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "document versions scoped read" on public.document_versions for select to authenticated using (public.can_read_document(document_id));
create policy "document versions controlled write" on public.document_versions for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "document access audit read" on public.document_access_events for select to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "legal hold restricted" on public.legal_holds for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','LEGAL_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','LEGAL_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));

create policy "registrations scoped read" on public.registrations for select to authenticated using (public.can_access_compliance() or public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "registrations controlled write" on public.registrations for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "registration documents read" on public.registration_documents for select to authenticated using (public.can_read_document(document_id));
create policy "registration documents write" on public.registration_documents for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "approval requests scoped read" on public.approval_requests for select to authenticated using (requested_by = auth.uid() or assigned_to = auth.uid() or public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "approval request create" on public.approval_requests for insert to authenticated with check (requested_by = auth.uid() and public.is_active_corporate_member());
create policy "approval request admin update" on public.approval_requests for update to authenticated using (assigned_to = auth.uid() or public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.is_active_corporate_member());
create policy "approval decisions scoped read" on public.approval_decisions for select to authenticated using (actor_id = auth.uid() or exists(select 1 from public.approval_requests r where r.id = request_id and (r.requested_by = auth.uid() or r.assigned_to = auth.uid())) or public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "approval decisions own create" on public.approval_decisions for insert to authenticated with check (actor_id = auth.uid() and public.is_active_corporate_member());
create policy "security incidents restricted" on public.security_incidents for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "statutory register read" on public.statutory_register_definitions for select to authenticated using (public.can_access_compliance());
create policy "statutory register write" on public.statutory_register_definitions for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','COMPLIANCE_REVIEWER','SYSTEM_ADMIN']::public.corporate_role[]));
create policy "statutory entries read" on public.statutory_register_entries for select to authenticated using (public.can_access_compliance());
create policy "statutory entries write" on public.statutory_register_entries for all to authenticated using (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[])) with check (public.has_active_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','SYSTEM_ADMIN']::public.corporate_role[]));

create or replace function public.write_audit_event(p_action text, p_entity_type text, p_entity_id uuid, p_context jsonb default '{}'::jsonb) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; begin
  if not public.is_active_corporate_member() then raise exception 'Active corporate identity required'; end if;
  insert into public.audit_events(actor_id, action, entity_type, entity_id, context) values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_context, '{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.write_audit_event(text, text, uuid, jsonb) from public; grant execute on function public.write_audit_event(text, text, uuid, jsonb) to authenticated;

