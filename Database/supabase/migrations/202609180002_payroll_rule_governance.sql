-- Payroll rule versions are append-oriented. HR may draft source-backed company
-- rules, while approval is reserved to owner authority. Statutory/tax rules must
-- carry an authoritative source reference and are never inferred from this table.

insert into public.office_access_profile_permissions(profile_code,permission_code,effect,default_scope_type) values
 ('HR_MANAGER','payroll.rules.manage','ALLOW','COMPANY')
on conflict(profile_code,permission_code) do update set effect=excluded.effect,default_scope_type=excluded.default_scope_type;

create or replace function public.office_payroll_rule_create(
 p_actor uuid,p_rule_code text,p_kind text,p_title text,p_jurisdiction text,p_effective_from date,p_effective_to date,p_configuration jsonb,p_source_reference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_version integer; code text:=upper(trim(p_rule_code)); kind text:=upper(trim(p_kind));
begin
 if not public.office_effective_permission(p_actor,'payroll.rules.manage','COMPANY',null,null) then raise exception 'Payroll rule management permission is required'; end if;
 if kind not in ('COMPANY_POLICY','PRORATION','LEAVE','STATUTORY','TAX','BENEFIT','OTHER') then raise exception 'Invalid payroll rule kind'; end if;
 if jsonb_typeof(coalesce(p_configuration,'{}'::jsonb))<>'object' then raise exception 'Payroll rule configuration must be an object'; end if;
 select coalesce(max(version),0)+1 into v_version from public.office_payroll_rule_versions where rule_code=code;
 insert into public.office_payroll_rule_versions(rule_code,version,rule_kind,title,jurisdiction,effective_from,effective_to,configuration,source_reference,created_by)
 values(code,v_version,kind,trim(p_title),upper(trim(coalesce(p_jurisdiction,'IN'))),p_effective_from,p_effective_to,coalesce(p_configuration,'{}'::jsonb),trim(p_source_reference),p_actor) returning id into v_id;
 insert into public.office_payroll_events(actor_user_id,event_type,note,metadata) values(p_actor,'PAYROLL_RULE_DRAFT_CREATED',code,jsonb_build_object('rule_id',v_id,'version',v_version,'kind',kind,'effective_from',p_effective_from,'source_reference',trim(p_source_reference)));
 return v_id;
end; $$;

create or replace function public.office_payroll_rule_approve(p_actor uuid,p_rule uuid,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare r public.office_payroll_rule_versions%rowtype; d text:=upper(trim(p_decision));
begin
 select * into r from public.office_payroll_rule_versions where id=p_rule for update;
 if r.id is null or r.status<>'DRAFT' then raise exception 'Payroll rule is not awaiting approval'; end if;
 if r.created_by=p_actor then raise exception 'Payroll rule creator cannot approve the same version'; end if;
 if not exists(select 1 from public.office_user_roles where user_id=p_actor and role='OWNER' and (expires_at is null or expires_at>now())) then raise exception 'OWNER authority is required to approve payroll rules'; end if;
 if d not in ('APPROVE','REJECT') then raise exception 'Invalid payroll rule decision'; end if;
 if d='APPROVE' then
   update public.office_payroll_rule_versions set status='RETIRED',effective_to=case when effective_to is null or effective_to>=r.effective_from then r.effective_from-1 else effective_to end,updated_at=now()
   where rule_code=r.rule_code and id<>r.id and status='APPROVED' and effective_from<r.effective_from and (effective_to is null or effective_to>=r.effective_from);
   update public.office_payroll_rule_versions set status='APPROVED',approved_by=p_actor,approved_at=now(),updated_at=now() where id=r.id;
 else
   update public.office_payroll_rule_versions set status='RETIRED',updated_at=now() where id=r.id;
 end if;
 insert into public.office_payroll_events(actor_user_id,event_type,note,metadata) values(p_actor,'PAYROLL_RULE_REVIEWED',left(trim(coalesce(p_note,'')),1000),jsonb_build_object('rule_id',r.id,'rule_code',r.rule_code,'version',r.version,'decision',d));
 return case when d='APPROVE' then 'APPROVED' else 'RETIRED' end;
end; $$;

revoke all on function public.office_payroll_rule_create(uuid,text,text,text,text,date,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.office_payroll_rule_approve(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_payroll_rule_create(uuid,text,text,text,text,date,date,jsonb,text) to service_role;
grant execute on function public.office_payroll_rule_approve(uuid,uuid,text,text) to service_role;
