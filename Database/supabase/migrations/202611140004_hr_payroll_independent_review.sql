-- KRAVIA HR payroll correction invariants.
-- Depends on 202611140003_hr_hours_payroll_revision_guards.sql.
-- No employee, salary, overtime policy, hour, tax rate or payout is seeded.
-- An independent reviewer MUST sign off on an evidence-backed snapshot.

create or replace function public.office_payroll_set_attendance_snapshot(p_actor uuid,p_period uuid,p_employment uuid,p_basis numeric,p_payable numeric,p_paid_leave numeric,p_unpaid_leave numeric,p_absence numeric,p_unresolved numeric,p_source jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; emp public.office_employment_registry%rowtype; v_id uuid;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll period is not open for attendance preparation'; end if;
 select * into emp from public.office_employment_registry where employment_id=p_employment;
 if emp.employment_id is null then raise exception 'Employment record not found'; end if;
 if per.period_kind='MONTHLY' and (
      emp.status='PLANNED' or emp.start_date is null or emp.start_date>per.ends_on
      or (emp.end_date is not null and emp.end_date<per.starts_on)) then
    raise exception 'Monthly payroll requires verified employment dates covering the pay month';
 end if;
 if p_basis is null or p_payable is null or p_basis<=0 or p_payable<0 or p_payable>p_basis then
    raise exception 'Invalid payroll attendance units';
  end if;
  if coalesce(p_paid_leave,-1)<0 or coalesce(p_unpaid_leave,-1)<0 or coalesce(p_absence,-1)<0
     or coalesce(p_unresolved,-1)<0 or p_paid_leave>p_payable then
    raise exception 'Invalid leave, absence or unresolved payroll hours';
  end if;
  if abs(p_payable+p_unpaid_leave+p_absence+p_unresolved-p_basis)>0.001 then
    raise exception 'Reviewed payable, unpaid leave, absence and unresolved hours must reconcile exactly to basis';
  end if;
  if coalesce(length(trim(p_source->>'source')),0)<3 then
    raise exception 'Attendance source type is mandatory';
  end if;
  if p_source->>'source'='HR_EVIDENCE_REVIEW' and
      (coalesce(length(trim(p_source->>'evidence_reference')),0)<5 or
       coalesce(length(trim(p_source->>'note')),0)<8) then
    raise exception 'Manual payroll attendance requires a traceable document and review note';
  end if;
  if p_source->>'source'='INDEPENDENTLY_APPROVED_WORKTIME'
     and p_payable>0 and (jsonb_typeof(p_source->'source_case_ids')<>'array'
                          or jsonb_array_length(p_source->'source_case_ids')=0) then
    raise exception 'Verified worktime hours require independently approved source cases';
  end if;
 insert into public.office_payroll_attendance_snapshots(period_id,employment_id,employee_user_id,basis_units,payable_units,paid_leave_units,unpaid_leave_units,absence_units,unresolved_units,source_snapshot,status,prepared_by)
 values(per.id,emp.employment_id,emp.identity_user_id,p_basis,p_payable,coalesce(p_paid_leave,0),coalesce(p_unpaid_leave,0),coalesce(p_absence,0),coalesce(p_unresolved,0),coalesce(p_source,'{}'::jsonb),'DRAFT',p_actor)
 on conflict(period_id,employment_id) do update set basis_units=excluded.basis_units,payable_units=excluded.payable_units,paid_leave_units=excluded.paid_leave_units,unpaid_leave_units=excluded.unpaid_leave_units,absence_units=excluded.absence_units,unresolved_units=excluded.unresolved_units,source_snapshot=excluded.source_snapshot,status=excluded.status,prepared_by=p_actor,reviewed_by=null,reviewed_at=null,updated_at=now() returning id into v_id;
 update public.office_payroll_periods set status='ATTENDANCE_READY',updated_at=now() where id=per.id and status='DRAFT';
 insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata)
    values(p_actor,per.id,emp.employment_id,'ATTENDANCE_SNAPSHOT_RECORDED',
      jsonb_build_object('basis_units',p_basis,'payable_units',p_payable,
       'unresolved_units',p_unresolved,'review_required',true,'source',p_source));
 return v_id;
end; $$;


-- Atomic optimistic concurrency wrapper. The existing payroll writer remains
-- server-only; this wrapper locks the period before checking the snapshot.
create or replace function public.office_payroll_set_attendance_snapshot_v2(
  p_actor uuid,p_period uuid,p_employment uuid,p_basis numeric,p_payable numeric,
  p_paid_leave numeric,p_unpaid_leave numeric,p_absence numeric,p_unresolved numeric,
  p_source jsonb,p_expected_updated_at timestamptz default null,
  p_correction_reason text default null
) returns uuid language plpgsql security definer set search_path='' as $kravia_hr$
declare
  per public.office_payroll_periods%rowtype;
  previous public.office_payroll_attendance_snapshots%rowtype;
begin
  if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then
    raise exception 'Payroll preparation permission required';
  end if;
  select * into per from public.office_payroll_periods where id=p_period for update;
  if not found or per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then
    raise exception 'Payroll period cannot be changed after submission';
  end if;
  select * into previous from public.office_payroll_attendance_snapshots
    where period_id=p_period and employment_id=p_employment for update;
  if found then
    if p_expected_updated_at is null or previous.updated_at is distinct from p_expected_updated_at then
      raise exception 'Payroll attendance changed; refresh before editing';
    end if;
    if coalesce(length(trim(p_correction_reason)),0)<12 then
      raise exception 'An evidence-backed correction reason is mandatory';
    end if;
    p_source:=coalesce(p_source,'{}'::jsonb) || jsonb_build_object(
       'correction_reason',trim(p_correction_reason),
       'previous_snapshot_id',previous.id,'previous_reviewed_by',previous.reviewed_by);
  elsif p_expected_updated_at is not null then
    raise exception 'Attendance snapshot was replaced or deleted; refresh before editing';
  end if;
  return public.office_payroll_set_attendance_snapshot(
    p_actor,p_period,p_employment,p_basis,p_payable,p_paid_leave,
    p_unpaid_leave,p_absence,p_unresolved,p_source);
end; $kravia_hr$;

-- Only a distinct reviewer, never the beneficiary or preparer, may certify
-- regular hours. Review is an actual auditable action, not a derived status.
create or replace function public.office_payroll_review_attendance(
  p_actor uuid,p_snapshot uuid,p_decision text,p_note text
) returns text language plpgsql security definer set search_path='' as $kravia_hr$
declare
  snap public.office_payroll_attendance_snapshots%rowtype;
  per public.office_payroll_periods%rowtype;
  decision text:=upper(trim(p_decision));
begin
  if decision not in ('APPROVE','REJECT') then raise exception 'Invalid attendance decision'; end if;
  if not public.office_effective_permission(p_actor,'payroll.run.review','COMPANY',null,null) then
    raise exception 'Independent payroll review permission is required'; end if;
  select * into snap from public.office_payroll_attendance_snapshots where id=p_snapshot;
  if not found then raise exception 'Attendance snapshot not found'; end if;
  -- Lock ordering mirrors the attendance writer: period first, then snapshot.
  select * into per from public.office_payroll_periods where id=snap.period_id for update;
  if not found or per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then
    raise exception 'Payroll attendance review is locked after submission'; end if;
  select * into snap from public.office_payroll_attendance_snapshots where id=p_snapshot for update;
  if not found or snap.period_id<>per.id or snap.status<>'DRAFT' then
    raise exception 'Only current draft attendance can be reviewed'; end if;
  if p_actor=snap.prepared_by or p_actor=snap.employee_user_id then
    raise exception 'Attendance preparer and beneficiary cannot review their own payroll hours'; end if;
  if decision='APPROVE' then
    if snap.unresolved_units>0 then raise exception 'Unresolved worktime, paid leave and holiday evidence must be reviewed first'; end if;
    if abs(snap.payable_units+snap.unpaid_leave_units+snap.absence_units+snap.unresolved_units-snap.basis_units)>0.001 then
      raise exception 'Attendance hours do not reconcile';
    end if;
    if length(trim(coalesce(snap.source_snapshot->>'source','')))<3 then
      raise exception 'Attendance review requires source records';
    end if;
  end if;
  update public.office_payroll_attendance_snapshots set
    status=case when decision='APPROVE' then 'REVIEWED' else 'DRAFT' end,
    reviewed_by=case when decision='APPROVE' then p_actor else null end,
    reviewed_at=case when decision='APPROVE' then now() else null end,
    updated_at=now()
    where id=p_snapshot;
  insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata)
    values(p_actor,snap.period_id,snap.employment_id,'ATTENDANCE_INDEPENDENT_REVIEW',
      jsonb_build_object('snapshot_id',snap.id,'decision',decision,'note',left(coalesce(p_note,''),1000),
      'prepared_by',snap.prepared_by,'employee',snap.employee_user_id));
  return case when decision='APPROVE' then 'REVIEWED' else 'REQUIRES_CORRECTION' end;
end; $kravia_hr$;

create or replace function public.office_payroll_review_adjustment(p_actor uuid,p_adjustment uuid,p_decision text)
returns text language plpgsql security definer set search_path='' as $$
declare a public.office_payroll_adjustments%rowtype; d text:=upper(trim(p_decision));
begin
 select * into a from public.office_payroll_adjustments where id=p_adjustment for update;
 if a.id is null or a.status<>'DRAFT' then raise exception 'Payroll adjustment is not awaiting review'; end if;
 if a.created_by=p_actor or a.employee_user_id=p_actor then raise exception 'Neither adjustment creator nor beneficiary may review their own adjustment'; end if;
 if not public.office_effective_permission(p_actor,'payroll.run.review','COMPANY',null,null) then raise exception 'Payroll review permission is required'; end if;
 if d not in ('APPROVE','REJECT') then raise exception 'Invalid adjustment decision'; end if;
 update public.office_payroll_adjustments set status=case when d='APPROVE' then 'APPROVED' else 'REJECTED' end,approved_by=p_actor,approved_at=now(),updated_at=now() where id=a.id;
 insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata) values(p_actor,a.period_id,a.employment_id,'PAYROLL_ADJUSTMENT_REVIEWED',jsonb_build_object('adjustment_id',a.id,'decision',d));
 return case when d='APPROVE' then 'APPROVED' else 'REJECTED' end;
end; $$;

create or replace function public.office_payroll_calculate(p_actor uuid,p_period uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare per public.office_payroll_periods%rowtype; snap record; comp public.office_compensation_versions%rowtype; pending_count integer; calc_version integer; earn bigint; deduct bigint; employer bigint; prorated bigint; net bigint; payload jsonb; hash text; result_count integer:=0; midperiod_count integer;
begin
 if not public.office_effective_permission(p_actor,'payroll.run.prepare','COMPANY',null,null) then raise exception 'Payroll preparation permission is required'; end if;
 select * into per from public.office_payroll_periods where id=p_period for update;
 if per.id is null or per.status not in ('ATTENDANCE_READY','CALCULATED') then raise exception 'Payroll attendance must be ready before calculation'; end if;
 select count(*) into pending_count from public.office_payroll_attendance_snapshots where period_id=per.id and unresolved_units>0;
 if pending_count>0 then raise exception 'Payroll contains unresolved attendance units'; end if;
  select count(*) into pending_count from public.office_payroll_attendance_snapshots
  where period_id=per.id and (status<>'REVIEWED' or reviewed_by is null
    or reviewed_by=prepared_by or reviewed_by=employee_user_id or reviewed_at is null);
  if pending_count>0 then raise exception 'Independently reviewed attendance snapshots are required before payroll calculation'; end if;
  if exists(select 1 from public.office_payroll_attendance_snapshots
    where period_id=per.id and
      abs(payable_units+unpaid_leave_units+absence_units+unresolved_units-basis_units)>0.001) then
    raise exception 'Payroll attendance allocation is not reconciled'; end if;
 if per.period_kind='MONTHLY' and exists(
    select 1 from public.office_payroll_attendance_snapshots s
    join public.office_employment_registry e on e.employment_id=s.employment_id
    where s.period_id=per.id and (e.status='PLANNED' or e.start_date is null
      or e.start_date>per.ends_on or (e.end_date is not null and e.end_date<per.starts_on))
 ) then raise exception 'Monthly payroll requires verified employment dates, not planned roles'; end if;
 select count(*) into pending_count from public.office_payroll_adjustments where period_id=per.id and status='DRAFT';
 if pending_count>0 then raise exception 'Payroll contains unreviewed adjustments'; end if;
 calc_version:=per.calculation_version+1;
 update public.office_payroll_results set status='SUPERSEDED' where period_id=per.id and status='CALCULATED';
 for snap in select * from public.office_payroll_attendance_snapshots where period_id=per.id order by employment_id loop
   select count(*) into midperiod_count from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from>per.starts_on and effective_from<=per.ends_on;
   if midperiod_count>0 then raise exception 'Mid-period compensation change requires an explicit arrears/off-cycle adjustment before calculation'; end if;
   select * into comp from public.office_compensation_versions where employment_id=snap.employment_id and status='APPROVED' and effective_from<=per.starts_on and (effective_to is null or effective_to>=per.starts_on) order by effective_from desc limit 1;
   if comp.id is null then raise exception 'Approved compensation is missing for payroll employment %',snap.employment_id; end if;
   select coalesce(sum(amount_minor),0) into earn from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EARNING' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into deduct from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='DEDUCTION' and currency=comp.currency;
   select coalesce(sum(amount_minor),0) into employer from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and adjustment_kind='EMPLOYER_COST' and currency=comp.currency;
   if exists(select 1 from public.office_payroll_adjustments where period_id=per.id and employment_id=snap.employment_id and status='APPROVED' and currency<>comp.currency) then raise exception 'Payroll adjustments must match compensation currency'; end if;
   prorated:=round(comp.monthly_gross_minor::numeric*snap.payable_units/snap.basis_units)::bigint;
   net:=prorated+earn-deduct;
   if net<0 then raise exception 'Payroll deductions exceed payable earnings'; end if;
   payload:=jsonb_build_object('period_id',per.id,'employment_id',snap.employment_id,'compensation_version_id',comp.id,'monthly_gross_minor',comp.monthly_gross_minor,'basis_units',snap.basis_units,'payable_units',snap.payable_units,'paid_leave_units',snap.paid_leave_units,'unpaid_leave_units',snap.unpaid_leave_units,'absence_units',snap.absence_units,'earnings_minor',earn,'deductions_minor',deduct,'employer_costs_minor',employer,'net_pay_minor',net,'currency',comp.currency,'calculation_version',calc_version);
   hash:=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex');
   insert into public.office_payroll_results(period_id,employment_id,employee_user_id,compensation_version_id,currency,base_gross_minor,prorated_gross_minor,additional_earnings_minor,deductions_minor,employer_costs_minor,net_pay_minor,line_items,calculation_snapshot,calculation_hash,calculation_version,calculated_by)
   values(per.id,snap.employment_id,snap.employee_user_id,comp.id,comp.currency,comp.monthly_gross_minor,prorated,earn,deduct,employer,net,jsonb_build_array(jsonb_build_object('code','BASE_GROSS','amount_minor',prorated),jsonb_build_object('code','ADDITIONAL_EARNINGS','amount_minor',earn),jsonb_build_object('code','DEDUCTIONS','amount_minor',deduct),jsonb_build_object('code','EMPLOYER_COSTS','amount_minor',employer)),payload,hash,calc_version,p_actor);
   result_count:=result_count+1;
 end loop;
 if result_count=0 then raise exception 'No payroll attendance snapshots are available'; end if;
 update public.office_payroll_periods set status='CALCULATED',calculation_version=calc_version,approval_request_id=null,updated_at=now() where id=per.id;
 insert into public.office_payroll_events(actor_user_id,period_id,event_type,metadata) values(p_actor,per.id,'PAYROLL_CALCULATED',jsonb_build_object('calculation_version',calc_version,'employee_count',result_count));
 return result_count;
end; $$;


-- Database-level invariants also guard against accidental direct service writes.
-- Reject inconsistent existing rows instead of silently reclassifying wages.
do $kravia_hr_constraint$
begin
  if not exists(select 1 from pg_constraint where conname='office_payroll_hours_reconcile_v2') then
    alter table public.office_payroll_attendance_snapshots
      add constraint office_payroll_hours_reconcile_v2
      check (paid_leave_units<=payable_units
        and abs(payable_units+unpaid_leave_units+absence_units+unresolved_units-basis_units)<=0.001);
  end if;
  if not exists(select 1 from pg_constraint where conname='office_payroll_review_independence_v2') then
    alter table public.office_payroll_attendance_snapshots
      add constraint office_payroll_review_independence_v2
      check (status='DRAFT' or (reviewed_by is not null and reviewed_at is not null
        and reviewed_by<>prepared_by and reviewed_by<>employee_user_id));
  end if;
end; $kravia_hr_constraint$;

-- The previous draft-change trigger must allow ONLY the normal
-- REVIEWED -> LOCKED status transition performed by approved payroll sync.
-- Any alteration to hours, evidence or review identities after approval fails.
create or replace function public.office_payroll_invalidate_changed_draft()
returns trigger language plpgsql security definer set search_path='' as $kravia_hr$
declare
  per public.office_payroll_periods%rowtype;
  old_evidence jsonb;
  new_evidence jsonb:=to_jsonb(NEW);
  audit_actor uuid;
begin
  select * into per from public.office_payroll_periods
    where id=(new_evidence->>'period_id')::uuid for update;
  if not found then raise exception 'Payroll period missing'; end if;
  if TG_OP='UPDATE' then old_evidence:=to_jsonb(OLD); end if;

  if per.status='APPROVED' and TG_TABLE_NAME='office_payroll_attendance_snapshots'
     and TG_OP='UPDATE'
     and OLD.status='REVIEWED' and NEW.status='LOCKED'
     and (new_evidence - 'status' - 'updated_at')=(old_evidence - 'status' - 'updated_at') then
    return NEW; -- Legitimate approved-run locking, not a salary mutation.
  end if;

  if per.status not in ('DRAFT','ATTENDANCE_READY','CALCULATED') then
    raise exception 'Submitted, approved, and paid payroll inputs cannot be rewritten';
  end if;
  audit_actor:=coalesce(
    case when TG_OP='UPDATE' and new_evidence->>'status' is distinct from old_evidence->>'status'
       then nullif(new_evidence->>'reviewed_by','')::uuid end,
    case when TG_OP='UPDATE' and new_evidence->>'status' is distinct from old_evidence->>'status'
       then nullif(new_evidence->>'approved_by','')::uuid end,
    nullif(new_evidence->>'prepared_by','')::uuid,
    nullif(new_evidence->>'created_by','')::uuid);
  if audit_actor is null then raise exception 'Payroll change actor is missing'; end if;
  if per.status='CALCULATED' then
    update public.office_payroll_results set status='SUPERSEDED'
      where period_id=per.id and status='CALCULATED';
    update public.office_payroll_periods set
      status='ATTENDANCE_READY',approval_request_id=null,updated_at=now()
      where id=per.id;
  end if;
  insert into public.office_payroll_events(actor_user_id,period_id,employment_id,event_type,metadata)
    values(audit_actor,per.id,(new_evidence->>'employment_id')::uuid,
    'PAYROLL_DRAFT_INPUT_CHANGED',jsonb_build_object(
      'relation',TG_TABLE_NAME,'operation',TG_OP,
      'invalidated_calculation',per.status='CALCULATED',
      'before',old_evidence,'after',new_evidence));
  return NEW;
end; $kravia_hr$;

revoke all on function public.office_payroll_set_attendance_snapshot_v2(
  uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,timestamptz,text) from public,anon,authenticated;
revoke all on function public.office_payroll_review_attendance(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.office_payroll_set_attendance_snapshot_v2(
  uuid,uuid,uuid,numeric,numeric,numeric,numeric,numeric,numeric,jsonb,timestamptz,text) to service_role;
grant execute on function public.office_payroll_review_attendance(uuid,uuid,text,text) to service_role;
revoke all on function public.office_payroll_invalidate_changed_draft() from public,anon,authenticated;
