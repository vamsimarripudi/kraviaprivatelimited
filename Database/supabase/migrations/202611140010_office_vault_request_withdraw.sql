-- KRAVIA Office 5.0: auditable withdrawal of an unanswered K-Vault access request.
-- An employee may withdraw their own PENDING request; no decision/grant changes.
create or replace function public.office_vault_withdraw_access(p_actor uuid,p_request uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare r public.office_vault_access_requests%rowtype;
begin
 select * into r from public.office_vault_access_requests where id=p_request for update;
 if r.id is null or r.status<>'PENDING' or r.requester_user_id<>p_actor then
   raise exception 'Pending request not available for withdrawal';
 end if;
 if not exists(select 1 from public.office_identity_users
               where user_id=p_actor and status='ACTIVE') then
   raise exception 'Active Office identity required';
 end if;
 update public.office_vault_access_requests set status='WITHDRAWN',decided_at=now()
 where id=r.id;
 insert into public.office_vault_access_events(
   request_id,actor_user_id,event_type,category_slug,resource_id
 ) values(r.id,p_actor,'WITHDRAWN',r.category_slug,r.resource_id);
 return true;
end; $$;
revoke all on function public.office_vault_withdraw_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_vault_withdraw_access(uuid,uuid) to service_role;
