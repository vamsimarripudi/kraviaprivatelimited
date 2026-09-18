-- KRAVIA Office OS — portfolio lifecycle hardening.
-- Dependency and membership changes are reversible state transitions; no history is deleted.

alter table public.office_portfolio_dependencies
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.office_portfolio_workstream_transition(
 p_actor uuid,p_workstream uuid,p_status text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare w public.office_portfolio_workstreams%rowtype; p public.office_portfolio_projects%rowtype; target text:=upper(trim(p_status));
begin
 select * into w from public.office_portfolio_workstreams where id=p_workstream for update;
 if w.id is null then raise exception 'Workstream not found'; end if;
 select * into p from public.office_portfolio_projects where id=w.project_id;
 if p_actor<>w.owner_user_id
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then
   raise exception 'Workstream ownership or management permission is required';
 end if;
 if w.status='PLANNED' and target not in ('ACTIVE','CANCELLED') then raise exception 'Planned workstream must start or be cancelled'; end if;
 if w.status='ACTIVE' and target not in ('PAUSED','DONE','CANCELLED') then raise exception 'Active workstream may be paused, completed or cancelled'; end if;
 if w.status='PAUSED' and target not in ('ACTIVE','CANCELLED') then raise exception 'Paused workstream may resume or be cancelled'; end if;
 if w.status in ('DONE','CANCELLED') then raise exception 'Finalized workstream cannot be transitioned'; end if;
 if target='DONE' and exists(
   select 1 from public.office_portfolio_milestones
   where workstream_id=w.id and status not in ('DONE','CANCELLED')
 ) then raise exception 'All workstream milestones must be completed or cancelled first'; end if;
 update public.office_portfolio_workstreams set status=target,updated_at=now() where id=w.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,event_type,previous_status,new_status,note)
 values(p_actor,w.project_id,w.id,'WORKSTREAM_TRANSITION',w.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_portfolio_dependency_create(
 p_actor uuid,p_project uuid,p_predecessor uuid,p_successor uuid,p_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.office_portfolio_projects%rowtype; v_id uuid;
begin
 select * into p from public.office_portfolio_projects where id=p_project;
 if p.id is null then raise exception 'Project not found'; end if;
 if not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then
   raise exception 'Milestone management permission is required';
 end if;
 if p_predecessor=p_successor then raise exception 'Milestone cannot depend on itself'; end if;
 if not exists(select 1 from public.office_portfolio_milestones where id=p_predecessor and project_id=p.id)
    or not exists(select 1 from public.office_portfolio_milestones where id=p_successor and project_id=p.id) then
   raise exception 'Both milestones must belong to the project';
 end if;
 if exists(
   with recursive path(node_id) as (
     select p_successor
     union
     select d.successor_milestone_id
     from public.office_portfolio_dependencies d
     join path on d.predecessor_milestone_id=path.node_id
     where d.project_id=p.id and d.active=true
   )
   select 1 from path where node_id=p_predecessor
 ) then raise exception 'Milestone dependency would create a cycle'; end if;
 insert into public.office_portfolio_dependencies(project_id,predecessor_milestone_id,successor_milestone_id,note,created_by,active)
 values(p.id,p_predecessor,p_successor,nullif(trim(coalesce(p_note,'')),''),p_actor,true)
 on conflict(predecessor_milestone_id,successor_milestone_id)
 do update set active=true,note=excluded.note,updated_at=now()
 returning id into v_id;
 insert into public.office_portfolio_events(actor_user_id,project_id,milestone_id,event_type,metadata)
 values(p_actor,p.id,p_successor,'MILESTONE_DEPENDENCY_ENABLED',jsonb_build_object('predecessor_milestone_id',p_predecessor));
 return v_id;
end; $$;

create or replace function public.office_portfolio_dependency_deactivate(
 p_actor uuid,p_dependency uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $$
declare d public.office_portfolio_dependencies%rowtype; p public.office_portfolio_projects%rowtype;
begin
 select * into d from public.office_portfolio_dependencies where id=p_dependency for update;
 if d.id is null or d.active=false then raise exception 'Active dependency is required'; end if;
 select * into p from public.office_portfolio_projects where id=d.project_id;
 if not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then
   raise exception 'Milestone management permission is required';
 end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Dependency change reason is required'; end if;
 update public.office_portfolio_dependencies set active=false,updated_at=now() where id=d.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,milestone_id,event_type,note,metadata)
 values(p_actor,d.project_id,d.successor_milestone_id,'MILESTONE_DEPENDENCY_DISABLED',left(p_reason,2000),jsonb_build_object('predecessor_milestone_id',d.predecessor_milestone_id,'dependency_id',d.id));
 return true;
end; $$;

create or replace function public.office_portfolio_milestone_transition(
 p_actor uuid,p_milestone uuid,p_status text,p_blocked_reason text,p_evidence text,p_note text
) returns text language plpgsql security definer set search_path='' as $$
declare m public.office_portfolio_milestones%rowtype; p public.office_portfolio_projects%rowtype; target text:=upper(trim(p_status));
begin
 select * into m from public.office_portfolio_milestones where id=p_milestone for update;
 if m.id is null then raise exception 'Milestone not found'; end if;
 select * into p from public.office_portfolio_projects where id=m.project_id;
 if p_actor<>m.owner_user_id
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.milestone.manage','DEPARTMENT',p.department_code,null) then
   raise exception 'Milestone ownership or management permission is required';
 end if;
 if target='IN_PROGRESS' and exists(
   select 1 from public.office_portfolio_dependencies d
   join public.office_portfolio_milestones predecessor on predecessor.id=d.predecessor_milestone_id
   where d.successor_milestone_id=m.id and d.active=true and predecessor.status<>'DONE'
 ) then raise exception 'Milestone dependencies must be completed before work starts'; end if;
 if target='BLOCKED' and nullif(trim(coalesce(p_blocked_reason,'')),'') is null then raise exception 'Blocked reason is required'; end if;
 if target='DONE' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'Milestone completion evidence is required'; end if;
 if target not in ('PLANNED','IN_PROGRESS','BLOCKED','DONE','CANCELLED') then raise exception 'Invalid milestone status'; end if;
 if m.status in ('DONE','CANCELLED') then raise exception 'Finalized milestone cannot be transitioned'; end if;
 update public.office_portfolio_milestones
 set status=target,
     blocked_reason=case when target='BLOCKED' then trim(p_blocked_reason) else null end,
     completion_evidence_reference=case when target='DONE' then trim(p_evidence) else completion_evidence_reference end,
     completed_at=case when target='DONE' then now() else null end,
     updated_at=now()
 where id=m.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,milestone_id,event_type,previous_status,new_status,note)
 values(p_actor,m.project_id,m.workstream_id,m.id,'MILESTONE_TRANSITION',m.status,target,left(p_note,2000));
 return target;
end; $$;

create or replace function public.office_portfolio_member_deactivate(
 p_actor uuid,p_member uuid,p_reason text
) returns boolean language plpgsql security definer set search_path='' as $$
declare m public.office_portfolio_members%rowtype; p public.office_portfolio_projects%rowtype;
begin
 select * into m from public.office_portfolio_members where id=p_member for update;
 if m.id is null or m.active=false then raise exception 'Active project membership is required'; end if;
 select * into p from public.office_portfolio_projects where id=m.project_id;
 if not public.office_effective_permission(p_actor,'portfolio.team.manage','COMPANY',null,null)
    and not public.office_effective_permission(p_actor,'portfolio.team.manage','DEPARTMENT',p.department_code,null) then
   raise exception 'Project team management permission is required';
 end if;
 if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Membership removal reason is required'; end if;
 update public.office_portfolio_members set active=false,updated_at=now() where id=m.id;
 insert into public.office_portfolio_events(actor_user_id,project_id,workstream_id,event_type,note,metadata)
 values(p_actor,m.project_id,m.workstream_id,'PROJECT_MEMBER_DEACTIVATED',left(p_reason,2000),jsonb_build_object('user_id',m.user_id,'project_role',m.project_role,'membership_id',m.id));
 return true;
end; $$;

revoke all on function public.office_portfolio_workstream_transition(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_dependency_create(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_dependency_deactivate(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_milestone_transition(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.office_portfolio_member_deactivate(uuid,uuid,text) from public,anon,authenticated;

grant execute on function public.office_portfolio_workstream_transition(uuid,uuid,text,text) to service_role;
grant execute on function public.office_portfolio_dependency_create(uuid,uuid,uuid,uuid,text) to service_role;
grant execute on function public.office_portfolio_dependency_deactivate(uuid,uuid,text) to service_role;
grant execute on function public.office_portfolio_milestone_transition(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.office_portfolio_member_deactivate(uuid,uuid,text) to service_role;
