create table public.record_amendments (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, reason text not null, replacement_reference text, requested_by uuid not null references public.profiles(id), approved_by uuid references public.profiles(id), created_at timestamptz not null default now());
alter table public.record_amendments enable row level security;
create policy "amendments: board reviewers" on public.record_amendments for select to authenticated using (public.has_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','LEGAL_REVIEWER']::public.corporate_role[]));
create policy "amendments: privileged create" on public.record_amendments for insert to authenticated with check (public.has_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY']::public.corporate_role[]));

create function public.prevent_finalised_record_overwrite() returns trigger language plpgsql security definer set search_path = public as $$ begin if old.status = 'FINAL' and (new.draft_minutes is distinct from old.draft_minutes or new.approved_minutes_document_id is distinct from old.approved_minutes_document_id or new.status is distinct from old.status) then raise exception 'Finalised meeting records must be amended, not overwritten'; end if; return new; end; $$;
create trigger board_meeting_final_guard before update on public.board_meetings for each row execute function public.prevent_finalised_record_overwrite();
create function public.prevent_finalised_resolution_overwrite() returns trigger language plpgsql security definer set search_path = public as $$ begin if old.status = 'FINAL' and (new.title is distinct from old.title or new.body is distinct from old.body or new.status is distinct from old.status) then raise exception 'Finalised resolutions must be amended, not overwritten'; end if; return new; end; $$;
create trigger resolution_final_guard before update on public.resolutions for each row execute function public.prevent_finalised_resolution_overwrite();

insert into storage.buckets (id, name, public) values ('corporate-private', 'corporate-private', false) on conflict (id) do update set public = false;
create policy "private storage: authorised metadata owners only" on storage.objects for select to authenticated using (bucket_id = 'corporate-private' and public.is_corporate_member());
create policy "private storage: privileged upload" on storage.objects for insert to authenticated with check (bucket_id = 'corporate-private' and public.has_corporate_role(array['DIRECTOR','CORPORATE_ADMIN','COMPANY_SECRETARY','CA_AUDITOR','LEGAL_REVIEWER']::public.corporate_role[]));
create policy "private storage: no client deletion" on storage.objects for delete to authenticated using (false);
